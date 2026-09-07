/** SHA-256 hex of a string. Works in browser and Node (>= 18) via WebCrypto. */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto unavailable');
  const digest = await subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Normalise raw hand text so equivalent files hash equal (BOM, CRLF, trailing spaces). */
export function normalizeRaw(text: string): string {
  return text
    .replace(/^\uFEFF+/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();
}
