import { createHash } from "node:crypto";

import { parseRange, type Range } from "../src/analysis.ts";
import {
  isKnownCard,
  parseCards,
  type Card,
  type KnownCard,
} from "../src/cards.ts";
import type { Hand, Transition, Violation } from "../src/hand.ts";
import { stateOf } from "../src/hand/state.ts";
import { entryOf, type Lookup } from "../src/lookups.ts";
import type { RandomSource } from "../src/random.ts";
import type { Result } from "../src/result.ts";
import { serializeHand } from "../src/storage.ts";

/** A hand's own fields as JSON, past the seal that keeps stray logs from printing them. */
export function rawJson(hand: Hand): string {
  return JSON.stringify({ ...stateOf(hand) });
}

export function sameTransition(
  a: Result<Transition, Violation>,
  b: Result<Transition, Violation>
): boolean {
  if (a.ok && b.ok) {
    return (
      serializeHand(a.value.hand) === serializeHand(b.value.hand) &&
      JSON.stringify(a.value.events) === JSON.stringify(b.value.events)
    );
  }
  return !a.ok && !b.ok && JSON.stringify(a.error) === JSON.stringify(b.error);
}

export function okValue<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Not ok: ${JSON.stringify(result.error)}`);
  return result.value;
}

export function cards(text: string): Array<Card> {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`Test cards do not parse: ${text}`);
  return [...parsed.value];
}

export function known(text: string): Array<KnownCard> {
  const parsed = cards(text);
  if (!parsed.every(isKnownCard)) {
    throw new Error(`Test cards are not all known: ${text}`);
  }
  return parsed;
}

/** pokerkit's `parse_range(*texts)`, which joins its arguments with a space. */
export function range(...texts: ReadonlyArray<string>): Range {
  const parsed = parseRange(texts.join(" "));
  if (!parsed.ok) throw new Error(`Test range does not parse: ${texts}`);
  return parsed.value;
}

/** Sorted cards of sorted combinations: equal for the same set, unequal on repeats. */
export function sortedCombos(
  combos: ReadonlyArray<ReadonlyArray<KnownCard>>
): Array<string> {
  return combos.map((combo) => combo.toSorted().join("")).toSorted();
}

export function scripted(values: ReadonlyArray<number>): RandomSource {
  const remaining = [...values];
  return {
    nextUint32: () => {
      const value = remaining.shift();
      if (value === undefined) throw new Error("Scripted values ran out");
      return value;
    },
  };
}

type Cards = ReadonlyArray<KnownCard>;

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
  const lines = Array.from({ length: table.size }, (): Array<string> => []);
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
