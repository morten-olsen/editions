import { expect, it } from 'vitest';
import { readBoundedText } from './http.ts';

it('rejects a body over the byte budget even without Content-Length, and cancels it', async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(9));
      },
      pull(controller) {
        controller.enqueue(new Uint8Array(9));
        controller.close();
      },
      cancel() {
        cancelled = true;
      },
    }),
  );
  await expect(readBoundedText(response, 8)).rejects.toThrow('exceeds 8 bytes');
  expect(cancelled).toBe(true);
});

it('accepts a body exactly at its byte budget', async () => {
  expect(await readBoundedText(new Response('éé'), 4)).toBe('éé');
});
