import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extract } from '@extractus/article-extractor';
import { XMLParser } from 'fast-xml-parser';
import TurndownService from 'turndown';

import type { FeedFixture, FixtureArticle } from '../eval.ts';

// --- CLI ---

const args = process.argv.slice(2);
const url = args[0];
const outputName = args[1];
const skipExtract = args.includes('--rss-only');

if (!url || !outputName) {
  console.log('Usage: pnpm fetch-feed <rss-url> <output-name> [--rss-only]');
  console.log('');
  console.log('  --rss-only   Use RSS content only (skip full article extraction)');
  console.log('');
  console.log(
    'Example: pnpm fetch-feed https://www.theverge.com/rss/partner/subscriber-only-full-feed/rss.xml theverge',
  );
  process.exit(1);
}

// --- Helpers ---

const turndown = new TurndownService();

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractRssContent = (item: Record<string, unknown>): string => {
  const candidates = [item['content:encoded'], item['content'], item['description'], item['summary']];

  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 100) {
      return stripHtml(c);
    }
  }

  return typeof item['description'] === 'string' ? stripHtml(item['description']) : '';
};

const extractSummary = (item: Record<string, unknown>): string | null => {
  if (typeof item['description'] === 'string' && item['description'].length > 0) {
    return stripHtml(item['description']).slice(0, 500);
  }
  return null;
};

const extractFullContent = async (articleUrl: string): Promise<string | null> => {
  try {
    const result = await extract(articleUrl);
    if (!result?.content) {
      return null;
    }
    return turndown.turndown(result.content);
  } catch {
    return null;
  }
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// --- Main ---

const run = async (): Promise<void> => {
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;

  // Handle RSS 2.0 and Atom feeds
  const rss = parsed['rss'] as Record<string, unknown> | undefined;
  const channel = (rss?.['channel'] ?? parsed['feed']) as Record<string, unknown>;

  const rawItems = (channel['item'] ?? channel['entry'] ?? []) as Record<string, unknown>[];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const channelTitle =
    typeof channel['title'] === 'string'
      ? channel['title']
      : typeof channel['title'] === 'object'
        ? ((channel['title'] as Record<string, unknown>)['#text'] as string)
        : 'Unknown Feed';

  console.log(`Found ${items.length} items in "${channelTitle}"`);

  if (!skipExtract) {
    console.log('Extracting full article content from URLs (use --rss-only to skip)...\n');
  }

  const articles: FixtureArticle[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index] as Record<string, unknown>;

    const title =
      typeof item['title'] === 'string'
        ? item['title']
        : typeof item['title'] === 'object'
          ? ((item['title'] as Record<string, unknown>)['#text'] as string)
          : `Article ${index + 1}`;

    const link =
      typeof item['link'] === 'string'
        ? item['link']
        : typeof item['link'] === 'object'
          ? ((item['link'] as Record<string, unknown>)['@_href'] as string)
          : null;

    const pubDate = (item['pubDate'] ?? item['published'] ?? item['updated'] ?? null) as string | null;

    let content = extractRssContent(item);

    // Extract full article content from URL (matching the real pipeline)
    if (!skipExtract && link) {
      process.stdout.write(`  [${index + 1}/${items.length}] ${title.slice(0, 60)}...`);
      const fullContent = await extractFullContent(link);
      if (fullContent) {
        content = fullContent;
        process.stdout.write(` ${content.length} chars\n`);
      } else {
        process.stdout.write(` (fallback to RSS)\n`);
      }
      // Rate limit
      if (index < items.length - 1) {
        await sleep(500);
      }
    }

    articles.push({
      id: `article-${String(index + 1).padStart(3, '0')}`,
      title,
      content,
      summary: extractSummary(item),
      url: link,
      author: (() => {
        const raw = item['author'] ?? item['dc:creator'] ?? null;
        if (raw === null) {
          return null;
        }
        if (typeof raw === 'string') {
          return raw;
        }
        if (Array.isArray(raw)) {
          return raw.join(', ');
        }
        return String(raw);
      })(),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
    });
  }

  const fixture: FeedFixture = {
    source: {
      name: channelTitle,
      url: url,
      fetchedAt: new Date().toISOString(),
    },
    articles,
  };

  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/feeds');
  const outPath = path.join(outDir, `${outputName}.json`);
  await fs.writeFile(outPath, JSON.stringify(fixture, null, 2));

  console.log(`\nWrote ${articles.length} articles to ${outPath}`);
  console.log('\nSample titles:');
  for (const a of articles.slice(0, 5)) {
    console.log(`  - ${a.title}`);
  }
  console.log(`\nNext step: create labels with \`pnpm label ${outputName}.json\``);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
