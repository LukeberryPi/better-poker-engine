import { isKnownCard, type Card, type KnownCard } from "./cards.ts";
import { combinations } from "./combinations.ts";
import {
  categoryLabels,
  entryOf,
  lookup,
  type HandCategory,
  type LookupName,
} from "./lookups.ts";

export type HandType =
  | "standardHigh"
  | "standardLow"
  | "shortDeckHigh"
  | "eightOrBetterLow"
  | "regularLow"
  | "greekHigh"
  | "omahaHigh"
  | "omahaEightOrBetterLow"
  | "badugi"
  | "standardBadugi"
  | "kuhn"
  | "leduc"
  | "rhodeIsland"
  | "numeral211";

export type HandValue<T extends HandType = HandType> = {
  readonly type: T;
  readonly cards: readonly KnownCard[];
  readonly category: HandCategory;
  /** Higher is stronger; only comparable within one hand type. */
  readonly strength: number;
};

type Candidates = (
  hole: readonly KnownCard[],
  board: readonly KnownCard[]
) => (readonly KnownCard[])[];

function anyCards(size: number): Candidates {
  return (hole, board) => combinations([...hole, ...board], size);
}

const threeFromBoard: Candidates = (hole, board) =>
  combinations(board, 3).flatMap((three) => anyCards(5)(hole, three));

const twoFromHole: Candidates = (hole, board) =>
  combinations(hole, 2).flatMap((two) => threeFromBoard(two, board));

const badugiCards: Candidates = (hole, board) =>
  [4, 3, 2, 1].flatMap((size) => anyCards(size)(hole, board));

type HandRules = {
  readonly lookup: LookupName;
  /** Lower lookup indices are stronger. */
  readonly low: boolean;
  readonly candidates: Candidates;
};

export const handRules = {
  standardHigh: { lookup: "standard", low: false, candidates: anyCards(5) },
  standardLow: { lookup: "standard2", low: true, candidates: anyCards(5) },
  shortDeckHigh: { lookup: "shortDeck", low: false, candidates: anyCards(5) },
  eightOrBetterLow: {
    lookup: "eightOrBetter",
    low: true,
    candidates: anyCards(5),
  },
  regularLow: { lookup: "regular", low: true, candidates: anyCards(5) },
  greekHigh: { lookup: "standard", low: false, candidates: threeFromBoard },
  omahaHigh: { lookup: "standard", low: false, candidates: twoFromHole },
  omahaEightOrBetterLow: {
    lookup: "eightOrBetter",
    low: true,
    candidates: twoFromHole,
  },
  badugi: { lookup: "badugi", low: true, candidates: badugiCards },
  standardBadugi: {
    lookup: "standardBadugi",
    low: true,
    candidates: badugiCards,
  },
  kuhn: { lookup: "kuhn", low: false, candidates: anyCards(1) },
  leduc: { lookup: "leduc", low: false, candidates: anyCards(2) },
  rhodeIsland: { lookup: "rhodeIsland", low: false, candidates: anyCards(3) },
  numeral211: { lookup: "numeral211", low: false, candidates: anyCards(3) },
} satisfies Record<HandType, HandRules>;

/** These exact cards as a hand of `type`, as pokerkit's `Hand(cards)`. */
export function handValue<T extends HandType>(
  type: T,
  cards: readonly KnownCard[]
): HandValue<T> | null {
  const rules = handRules[type];
  const table = lookup(rules.lookup);
  const entry = entryOf(table, cards);
  if (entry === null) return null;
  const strength = rules.low ? table.size - 1 - entry.index : entry.index;
  return { type, cards, category: entry.category, strength };
}

/** The strongest hand of `type`; null if none forms or a card is not fully known. */
export function evaluate<T extends HandType>(
  type: T,
  hole: readonly Card[],
  board: readonly Card[]
): HandValue<T> | null {
  if (!hole.every(isKnownCard) || !board.every(isKnownCard)) return null;
  let best: HandValue<T> | null = null;
  for (const cards of handRules[type].candidates(hole, board)) {
    const value = handValue(type, cards);
    if (value !== null && (best === null || value.strength > best.strength)) {
      best = value;
    }
  }
  return best;
}

export function compareHands<T extends HandType>(
  a: HandValue<T>,
  b: HandValue<NoInfer<T>>
): -1 | 0 | 1 {
  if (a.strength === b.strength) return 0;
  return a.strength > b.strength ? 1 : -1;
}

/** pokerkit's `str(hand)`, e.g. `Straight flush (6s7s8s9sTs)`. */
export function describeHand(value: HandValue): string {
  return `${categoryLabels[value.category]} (${value.cards.join("")})`;
}
