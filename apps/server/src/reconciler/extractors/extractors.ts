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

// Empty until a site needs behaviour the default extractor can't provide.
// A previous Hacker News entry was deleted because it duplicated the
// default extraction exactly — add entries only when they diverge.
const extractors: ArticleExtractor[] = [];

const findExtractor = (url: string): ArticleExtractor | undefined => extractors.find((e) => e.match(url));

// --- Exports ---

export type { ExtractResult, ArticleExtractor };
export { findExtractor };
