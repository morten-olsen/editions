// Read decompressed bytes with a hard ceiling before handing a body to a parser.
// Content-Length is only a hint: chunked and compressed bodies need the same cap.
const readBoundedText = async (response: Response, maxBytes: number): Promise<string> => {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes`);
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
};

export { readBoundedText };
