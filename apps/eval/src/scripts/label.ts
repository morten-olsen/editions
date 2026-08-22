import { createInterface } from 'node:readline';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FeedFixture, LabelSet } from '../eval.ts';

// --- CLI ---

const args = process.argv.slice(2);
const fixtureName = args[0];

if (!fixtureName) {
  console.log('Usage: pnpm label <fixture-name.json>');
  console.log('Example: pnpm label theverge.json');
  process.exit(1);
}

// --- Types ---

type ReadlineInterface = ReturnType<typeof createInterface>;

// --- Helpers ---

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

const ask = (rl: ReadlineInterface, question: string): Promise<string> =>
  new Promise((resolve) => {
    rl.question(question, resolve);
  });

// Resume from existing labels if present
const loadOrCreateLabelSet = async (labelsPath: string): Promise<LabelSet> => {
  try {
    const labelSet: LabelSet = JSON.parse(await fs.readFile(labelsPath, 'utf-8'));
    console.log(`Resuming from existing labels (${Object.keys(labelSet.labels).length} already labeled)`);
    return labelSet;
  } catch {
    return {
      fixture: fixtureName,
      focuses: [],
      labels: {},
    };
  }
};

const parseFocus = (input: string): LabelSet['focuses'][number] => {
  const colonIndex = input.indexOf(':');
  if (colonIndex > 0) {
    return {
      name: input.slice(0, colonIndex).trim(),
      description: input.slice(colonIndex + 1).trim() || null,
    };
  }
  return { name: input.trim(), description: null };
};

const defineFocuses = async (params: {
  rl: ReadlineInterface;
  labelSet: LabelSet;
  feed: FeedFixture;
}): Promise<void> => {
  const { rl, labelSet, feed } = params;

  console.log(`\nFeed: "${feed.source.name}" (${feed.articles.length} articles)`);
  console.log('\nDefine your focuses (topic areas for classification).');
  console.log('Enter focus names one per line, blank line when done.');
  console.log('Format: "Name" or "Name: Description"\n');

  while (true) {
    const input = await ask(rl, 'Focus: ');
    if (!input.trim()) {
      break;
    }
    labelSet.focuses.push(parseFocus(input));
  }
};

const printInstructions = (labelSet: LabelSet): void => {
  const focusNames = labelSet.focuses.map((f) => f.name);

  console.log('\n--- Labeling ---');
  console.log('For each article, type the focus numbers that apply (e.g. "1 3"), or:');
  console.log('  (none) = article matches no focus');
  console.log('  s      = skip (come back later)');
  console.log('  q      = save and quit\n');
  console.log('Focuses:');
  focusNames.forEach((name, i) => {
    const desc = labelSet.focuses[i]?.description;
    console.log(`  ${i + 1}. ${name}${desc ? ` — ${desc}` : ''}`);
  });
  console.log('');
};

const parseSelection = (input: string, focusCount: number): number[] =>
  input
    .trim()
    .split(/[\s,]+/)
    .map((s) => parseInt(s, 10) - 1)
    .filter((i) => i >= 0 && i < focusCount);

const labelArticles = async (params: {
  rl: ReadlineInterface;
  feed: FeedFixture;
  labelSet: LabelSet;
}): Promise<{ labeled: number; skipped: number }> => {
  const { rl, feed, labelSet } = params;
  const focusNames = labelSet.focuses.map((f) => f.name);
  const focusKeys = focusNames.map((_, i) => String(i + 1));

  let labeled = 0;
  let skipped = 0;

  for (const article of feed.articles) {
    if (labelSet.labels[article.id]) {
      continue; // Already labeled
    }

    const preview = article.content
      ? article.content.slice(0, 200).replace(/\n/g, ' ')
      : (article.summary?.slice(0, 200) ?? '(no content)');

    console.log(`\n[${article.id}] ${article.title}`);
    console.log(`  ${preview}...`);

    const input = await ask(rl, `  Focuses [${focusKeys.join(',')}]: `);

    if (input.trim().toLowerCase() === 'q') {
      break;
    }

    if (input.trim().toLowerCase() === 's') {
      skipped++;
      continue;
    }

    const selectedIndices = parseSelection(input, focusNames.length);

    const articleLabels: Record<string, boolean> = {};
    for (let i = 0; i < focusNames.length; i++) {
      articleLabels[focusNames[i] as string] = selectedIndices.includes(i);
    }

    labelSet.labels[article.id] = articleLabels;
    labeled++;
  }

  return { labeled, skipped };
};

// --- Main ---

const run = async (): Promise<void> => {
  const feedPath = path.join(fixturesDir, 'feeds', fixtureName);
  const feed: FeedFixture = JSON.parse(await fs.readFile(feedPath, 'utf-8'));

  const labelsPath = path.join(fixturesDir, 'labels', fixtureName);
  const labelSet = await loadOrCreateLabelSet(labelsPath);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Define focuses if not already set
  if (labelSet.focuses.length === 0) {
    await defineFocuses({ rl, labelSet, feed });

    if (labelSet.focuses.length === 0) {
      console.log('No focuses defined, exiting.');
      rl.close();
      return;
    }

    console.log(`\nFocuses: ${labelSet.focuses.map((f) => f.name).join(', ')}`);
  }

  printInstructions(labelSet);

  const { labeled, skipped } = await labelArticles({ rl, feed, labelSet });

  // Save
  await fs.writeFile(labelsPath, JSON.stringify(labelSet, null, 2));

  const total = Object.keys(labelSet.labels).length;
  const remaining = feed.articles.length - total;
  console.log(`\nSaved ${total} labels to ${labelsPath}`);
  console.log(`  This session: ${labeled} labeled, ${skipped} skipped`);
  if (remaining > 0) {
    console.log(`  ${remaining} articles remaining — run again to continue`);
  }

  rl.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
