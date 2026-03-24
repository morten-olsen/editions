// --- Types ---

type ExtractResult = {
  content: string;
  title?: string;
  author?: string;
  description?: string;
  image?: string;
};

type ArticleExtractor = {
  name: string;
  match: (url: string) => boolean;
  extract: (url: string) => Promise<ExtractResult | null>;
};

// --- Registry ---

import { hackerNewsExtractor } from './extractors.hn.ts';

const extractors: ArticleExtractor[] = [hackerNewsExtractor];

const findExtractor = (url: string): ArticleExtractor | undefined =>
  extractors.find((e) => e.match(url));

// --- Exports ---

export type { ExtractResult, ArticleExtractor };
export { findExtractor };
