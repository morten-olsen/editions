import { expect, it } from 'vitest';
import { prepareClassificationText } from './reconciler.inference.ts';

it('keeps the full label and special tokens inside the token budget', () => {
  const countTokens = (text: string, label: string): number => text.length + label.length + 4;
  const text = prepareClassificationText('x'.repeat(2000), ['y'.repeat(20)], countTokens);
  expect(text).toBe('x'.repeat(250));
  expect(countTokens(text, 'y'.repeat(20))).toBe(274);
});

it('rejects a label that cannot fit even with an empty premise', () => {
  expect(() => prepareClassificationText('article', ['oversized'], () => 513)).toThrow('512-token budget');
});
