import { parseRange, type Range } from "../src/analysis.ts";
import {
  isKnownCard,
  parseCards,
  type Card,
  type KnownCard,
} from "../src/cards.ts";
import type { RandomSource } from "../src/random.ts";
import type { Result } from "../src/result.ts";

export function okValue<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Not ok: ${JSON.stringify(result.error)}`);
  return result.value;
}

export function cards(text: string): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`Test cards do not parse: ${text}`);
  return [...parsed.value];
}

export function known(text: string): KnownCard[] {
  const parsed = cards(text);
  if (!parsed.every(isKnownCard)) {
    throw new Error(`Test cards are not all known: ${text}`);
  }
  return parsed;
}

/** pokerkit's `parse_range(*texts)`, which joins its arguments with a space. */
export function range(...texts: readonly string[]): Range {
  const parsed = parseRange(texts.join(" "));
  if (!parsed.ok) throw new Error(`Test range does not parse: ${texts}`);
  return parsed.value;
}

/** Sorted cards of sorted combinations: equal for the same set, unequal on repeats. */
export function sortedCombos(
  combos: readonly (readonly KnownCard[])[]
): string[] {
  return combos.map((combo) => combo.toSorted().join("")).toSorted();
}

export function scripted(values: readonly number[]): RandomSource {
  const remaining = [...values];
  return {
    nextUint32: () => {
      const value = remaining.shift();
      if (value === undefined) throw new Error("Scripted values ran out");
      return value;
    },
  };
}
