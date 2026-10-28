import {
  cardOf,
  isKnownCard,
  parseCards,
  rankOrders,
  suits,
  type KnownCard,
  type Rank,
  type Suit,
} from "../cards.ts";
import { err, ok, type Result } from "../result.ts";

/** Hole-card combinations of distinct cards, none repeated: pokerkit's set of frozensets. */
export type Range = readonly (readonly KnownCard[])[];

/** `at` is the offset of the invalid notation in the parsed text, `text` the notation as written. */
export type RangeError = {
  readonly code: "invalid_range";
  readonly at: number;
  readonly text: string;
};

/** Combinations as one notation yields them, possibly repeating another's. */
type Combos = readonly (readonly KnownCard[])[];
type Suffix = "" | "s" | "o";
type SuitPair = readonly [Suit, Suit];

const anySuits = suits.flatMap((first) =>
  suits.map((second): SuitPair => [first, second])
);
const pairSuits = suits.flatMap((first, index) =>
  suits.slice(index + 1).map((second): SuitPair => [first, second])
);
const suitsBySuffix = {
  "": anySuits,
  s: suits.map((suit): SuitPair => [suit, suit]),
  o: anySuits.filter(([first, second]) => first !== second),
} satisfies Record<Suffix, readonly SuitPair[]>;

const order = rankOrders.standard.join("");
const topRank = order.charAt(order.length - 1);

function rankFrom(symbol: string): Rank | null {
  return rankOrders.standard.find((rank) => rank === symbol) ?? null;
}

function withSuits(
  first: string,
  second: string,
  pairs: readonly SuitPair[]
): Combos | null {
  const high = rankFrom(first);
  const low = rankFrom(second);
  if (high === null || low === null) return null;
  return pairs.map(([s0, s1]) => [cardOf(high, s0), cardOf(low, s1)]);
}

/** `AK`, `AKs`, `AKo` and pairs such as `JJ`; as in pokerkit, any `XXs` is no combination. */
function rankPair(
  first: string,
  second: string,
  suffix: Suffix
): Combos | null {
  if (first !== second) return withSuits(first, second, suitsBySuffix[suffix]);
  return suffix === "s" ? [] : withSuits(first, second, pairSuits);
}

function unionOf(parts: readonly (Combos | null)[]): Combos | null {
  return parts.every((part) => part !== null) ? parts.flat() : null;
}

/** `JTs-KQs`, `TT-JJ`: the second pair of ranks is the first shifted by whole ranks. */
function interval(
  r0: string,
  r1: string,
  r2: string,
  r3: string,
  suffix: Suffix
): Combos | null {
  const i0 = order.indexOf(r0);
  const i1 = order.indexOf(r1);
  const i2 = order.indexOf(r2);
  const i3 = order.indexOf(r3);
  if (Math.min(i0, i1, i2, i3) < 0 || i1 - i0 !== i3 - i2) return null;
  const start = Math.min(i0, i2);
  const steps = Array.from(
    { length: Math.abs(i2 - i0) + 1 },
    (_, step) => start + step
  );
  return unionOf(
    steps.map((index) =>
      rankPair(order.charAt(index), order.charAt(index + i1 - i0), suffix)
    )
  );
}

/** `JJ+` is every pair from JJ up; `QT+` raises the lower rank to just below the higher. */
function plus(r0: string, r1: string, suffix: Suffix): Combos | null {
  if (r0 === r1) return interval(r0, r1, topRank, topRank, suffix);
  const i0 = order.indexOf(r0);
  const i1 = order.indexOf(r1);
  if (i0 < 0 || i1 < 0) return null;
  const high = order.charAt(Math.max(i0, i1));
  const kickers = [...order.slice(Math.min(i0, i1), Math.max(i0, i1))];
  return unionOf(kickers.map((kicker) => rankPair(high, kicker, suffix)));
}

function explicitCards(notation: string): Combos | null {
  const parsed = parseCards(notation);
  if (!parsed.ok) return null;
  const cards = parsed.value;
  return cards.every(isKnownCard) ? [[...new Set(cards)]] : null;
}

/** pokerkit's patterns, matched on code points as Python matches characters. */
const rankNotation = /^(.)(.)([so]?)(\+|-(.)(.)\3)?$/su;

function combosOf(notation: string): Combos | null {
  const match = rankNotation.exec(notation);
  if (match === null) return explicitCards(notation);
  const [, r0 = "", r1 = "", third = "", tail = "", r2 = "", r3 = ""] = match;
  // SAFETY: the pattern's third group is empty, `s` or `o`.
  const suffix = third as Suffix;
  if (tail === "") return rankPair(r0, r1, suffix);
  if (tail === "+") return plus(r0, r1, suffix);
  return interval(r0, r1, r2, r3, suffix);
}

/** pokerkit's `parse_range`: notations separated by whitespace, commas or semicolons. */
export function parseRange(text: string): Result<Range, RangeError> {
  const combos = new Map<string, readonly KnownCard[]>();
  for (const token of text.matchAll(/[^\s,;]+/gu)) {
    const parsed = combosOf(token[0]);
    if (parsed === null) {
      return err({ code: "invalid_range", at: token.index, text: token[0] });
    }
    for (const combo of parsed) {
      const cards = combo.toSorted().join("");
      if (!combos.has(cards)) combos.set(cards, combo);
    }
  }
  return ok([...combos.values()]);
}
