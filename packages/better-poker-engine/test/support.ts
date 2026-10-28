import { createHash } from "node:crypto";

import {
  isKnownCard,
  parseCards,
  type Card,
  type KnownCard,
} from "../src/cards.ts";
import { entryOf, type Lookup } from "../src/lookups.ts";
import type { RandomSource } from "../src/random.ts";

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

type Cards = readonly KnownCard[];

/** Each `size`-card combination of `deck`, in `itertools.combinations` order. */
export function forEachCombination(
  deck: Cards,
  size: number,
  visit: (cards: Cards) => void,
  chosen: Cards = []
): void {
  if (size === 0) {
    visit(chosen);
    return;
  }
  deck.forEach((card, index) => {
    if (deck.length - index < size) return;
    forEachCombination(deck.slice(index + 1), size - 1, visit, [
      ...chosen,
      card,
    ]);
  });
}

/** md5 of pokerkit's `serialize_combinations` after a stable sort by entry. */
export function digestSortedByEntry(
  table: Lookup,
  combinations: (visit: (cards: Cards) => void) => void
): string {
  const lines = Array.from({ length: table.size }, (): string[] => []);
  combinations((hand) => {
    const entry = entryOf(table, hand);
    if (entry === null) throw new Error(`${hand.join("")} has no entry`);
    lines[entry.index]?.push(hand.join(""));
  });
  const md5 = createHash("md5");
  md5.update(
    lines
      .filter((bucket) => bucket.length > 0)
      .map((bucket) => bucket.join("\n"))
      .join("\n")
  );
  return md5.digest("hex");
}
