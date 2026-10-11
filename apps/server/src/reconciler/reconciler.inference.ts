type TokenCounter = (text: string, label: string) => number;

// Bound the complete premise/hypothesis pair before the pipeline adds tensors.
// Transformers.js truncates after adding special tokens, which can remove BART's
// EOS token and make its classification Gather fail on long token sequences.
const prepareClassificationText = (text: string, labels: string[], countTokens: TokenCounter): string => {
  let bounded = text.slice(0, 2000);
  while (labels.some((label) => countTokens(bounded, label) > 512)) {
    if (bounded.length === 0) throw new Error('Classification label exceeds the 512-token budget');
    bounded = bounded.slice(0, Math.floor(bounded.length / 2));
  }
  return bounded;
};

export type { TokenCounter };
export { prepareClassificationText };
