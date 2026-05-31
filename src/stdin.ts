/** Result of reading stdin: the full payload, or a too-large signal. */
export type StdinResult = { data: string } | { tooLarge: true };

/**
 * Read all of stdin into a string, bailing out if it exceeds `maxSize` bytes.
 * Callers format their own protocol-specific response on overflow.
 */
export async function readStdin(maxSize: number): Promise<StdinResult> {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > maxSize) return { tooLarge: true };
  }
  return { data: raw };
}
