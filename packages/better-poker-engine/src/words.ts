/** A run of text between separators; `at` is its offset in the text. */
export type Word = { readonly text: string; readonly at: number };

/** Python counts these as white space too, though Unicode does not. */
const informationSeparators = new Set(["\u001c", "\u001d", "\u001e", "\u001f"]);

/** Whether pokerkit's `str.split()` splits at `symbol`. JavaScript's `\s` differs:
 * it also matches U+FEFF, and misses U+0085 and the information separators. */
export function isWhitespace(symbol: string): boolean {
  return informationSeparators.has(symbol) || /^\p{White_Space}$/u.test(symbol);
}

/** The words pokerkit's `str.split()` finds in `text`. */
export function wordsOf(text: string): readonly Word[] {
  const spaced = Array.from(text, (symbol) =>
    isWhitespace(symbol) ? " " : symbol
  ).join("");
  return Array.from(spaced.matchAll(/[^ ]+/gu), (match) => ({
    text: match[0],
    at: match.index,
  }));
}
