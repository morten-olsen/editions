// --- Model configurations ---
// Add or remove models here to change what gets benchmarked.
// All bench scripts read from this shared config.

// Embedding models: ordered small → large for comparison
const EMBEDDING_MODELS = [
  // Small (~23-33MB, 384-dim) — fast, good baseline
  'Xenova/all-MiniLM-L6-v2',
  'Xenova/all-MiniLM-L12-v2',
  'Xenova/bge-small-en-v1.5',
  'Xenova/gte-small',

  // Medium (~67MB, 768-dim) — more capacity
  'Xenova/bge-base-en-v1.5',
  'Xenova/gte-base',
];

const CLASSIFIER_MODEL = 'Xenova/bart-large-mnli';

const STRATEGIES: ('similarity' | 'nli')[] = ['similarity', 'nli'];

// Models to run NLI on (NLI is ~100x slower than similarity,
// so we only run it on a subset for comparison)
const NLI_MODELS = new Set(['Xenova/all-MiniLM-L6-v2', 'Xenova/bge-base-en-v1.5']);

// --- Exports ---

export { EMBEDDING_MODELS, CLASSIFIER_MODEL, STRATEGIES, NLI_MODELS };
