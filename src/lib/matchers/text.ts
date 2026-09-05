/**
 * Text helpers shared by the matchers. Pure functions, no I/O.
 */

/** Trim, collapse whitespace, unify curly quotes/apostrophes, case-fold. */
export function normalize(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Words only: normalize, strip punctuation, split. */
export function tokens(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/**
 * Similarity in 0..1 based on edit distance: 1 = identical, 0 = nothing in common.
 * Levenshtein is easy to explain and good enough for short label strings.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

export function levenshtein(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Words in `a` that are not in `b`, and vice versa (after normalization). */
export function wordDiff(a: string, b: string): { missing: string[]; extra: string[] } {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  return {
    missing: [...ta].filter((w) => !tb.has(w)), // in application, not on label
    extra: [...tb].filter((w) => !ta.has(w)), // on label, not in application
  };
}

/** Jaccard similarity of the two word sets, 0..1. */
export function tokenSetSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size && !tb.size) return 1;
  let common = 0;
  for (const w of ta) if (tb.has(w)) common++;
  return common / (ta.size + tb.size - common);
}

export function quote(value: string | null | undefined): string {
  return value == null || value === "" ? "nothing" : `'${value}'`;
}

export function listWords(words: string[]): string {
  return words.map((w) => `'${w}'`).join(", ");
}
