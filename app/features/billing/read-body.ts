/**
 * Reads a request body as text, up to `maxBytes`. Returns null as soon as it
 * has seen more, without buffering the rest (F-389): a declared length is
 * only a claim, so the bytes themselves are counted.
 */
export async function readTextUpTo(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string | null> {
  if (body === null) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}
