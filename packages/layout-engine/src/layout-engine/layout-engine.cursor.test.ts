import { prepareWithSegments } from '@chenglou/pretext';
import { describe, expect, it } from 'vitest';

import { cursorToOffset, offsetToCursor, preparedLength } from './layout-engine.cursor.ts';

const FONT = '16px serif';

describe('cursor mapping', () => {
  it('round-trips every offset in the text', () => {
    const text = 'The quiet revolution in reader design has been a long time coming.';
    const prepared = prepareWithSegments(text, FONT, { whiteSpace: 'pre-wrap' });

    for (let offset = 0; offset <= text.length; offset++) {
      expect(cursorToOffset(prepared, offsetToCursor(prepared, offset))).toBe(offset);
    }
  });

  it('treats the segment-relative grapheme index as such', () => {
    const text = 'alpha beta gamma';
    const prepared = prepareWithSegments(text, FONT, { whiteSpace: 'pre-wrap' });

    // The word 'gamma' starts at offset 11, well past the first segment. A
    // cursor pointing at it must not be read as offset 0-or-so.
    const cursor = offsetToCursor(prepared, 11);
    expect(cursor.segmentIndex).toBeGreaterThan(0);
    expect(cursorToOffset(prepared, cursor)).toBe(11);
    expect(text.slice(cursorToOffset(prepared, cursor))).toBe('gamma');
  });

  it('reports the full length of the prepared text', () => {
    const text = 'Paragraph one.\n\nParagraph two.';
    const prepared = prepareWithSegments(text, FONT, { whiteSpace: 'pre-wrap' });
    expect(preparedLength(prepared)).toBe(text.length);
  });

  it('handles text outside the basic multilingual plane', () => {
    const text = 'Data — the 🔭 telescope — resolved it.';
    const prepared = prepareWithSegments(text, FONT, { whiteSpace: 'pre-wrap' });

    expect(preparedLength(prepared)).toBe(text.length);
    for (let offset = 0; offset <= text.length; offset++) {
      const round = cursorToOffset(prepared, offsetToCursor(prepared, offset));
      // Offsets inside a surrogate pair snap to its start.
      expect(round).toBeLessThanOrEqual(offset);
      expect(offset - round).toBeLessThanOrEqual(1);
    }
  });

  it('clamps offsets past the end', () => {
    const text = 'Short.';
    const prepared = prepareWithSegments(text, FONT, { whiteSpace: 'pre-wrap' });
    expect(cursorToOffset(prepared, offsetToCursor(prepared, 999))).toBe(text.length);
  });
});
