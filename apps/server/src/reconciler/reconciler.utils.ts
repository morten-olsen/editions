// --- Scope filter ---

type ScopeFilter = {
  sourceIds?: string[];
  focusIds?: string[];
};

// --- Text preparation ---

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const prepareText = (article: {
  title: string;
  content: string | null;
  summary: string | null;
  sourceType: string;
}): string | null => {
  const raw = article.content ?? (article.sourceType === 'podcast' ? article.summary : null);
  if (!raw) {
    return null;
  }
  return `${article.title}. ${stripHtml(raw)}`.slice(0, 2000);
};

// Model output must never become a SQL NULL score (SQLite binds NaN as NULL).
const isValidEmbedding = (embedding: Float32Array | null): embedding is Float32Array =>
  embedding !== null && embedding.length > 0 && embedding.every(Number.isFinite);

// --- Exports ---

export type { ScopeFilter };
export { stripHtml, prepareText, isValidEmbedding };
