import { extract } from '@extractus/article-extractor';

import type { ArticleExtractor } from './extractors.ts';

// --- Helpers ---

const HN_HOSTS = ['news.ycombinator.com', 'hacker-news.firebaseio.com'];

const isHnUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname;
    return HN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

/**
 * HN feed items link to the external article, not to the HN comments page.
 * We extract from that external URL using the default extractor — HN itself
 * has no article content to extract.
 *
 * The main value of this custom extractor is future HN-specific tweaks
 * (e.g., falling back to HN API for metadata, handling "Show HN" posts).
 */
const extractHnArticle = async (url: string): ReturnType<ArticleExtractor['extract']> => {
  const result = await extract(url);
  if (!result?.content) {
    return null;
  }
  return {
    content: result.content,
    title: result.title ?? undefined,
    author: result.author ?? undefined,
    description: result.description ?? undefined,
    image: result.image ?? undefined,
  };
};

// --- Extractor ---

const hackerNewsExtractor: ArticleExtractor = {
  name: 'hacker-news',
  match: isHnUrl,
  extract: extractHnArticle,
};

// --- Exports ---

export { hackerNewsExtractor };
