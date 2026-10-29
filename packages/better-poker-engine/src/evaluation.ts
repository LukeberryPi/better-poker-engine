import { isKnownCard, type Card, type KnownCard } from "./cards.ts";
import { combinations } from "./combinations.ts";
import {
  cardKeyOf,
  categoryLabels,
  entryAt,
  entryOf,
  lookup,
  type Entry,
  type HandCategory,
  type Lookup,
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

/** Positions in `[...hole, ...board]` of each card set that may form a hand. */
type Candidates = (
  hole: readonly number[],
  board: readonly number[]
) => (readonly number[])[];

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

const handRules = {
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

function strengthOf(rules: HandRules, table: Lookup, entry: Entry): number {
  return rules.low ? table.size - 1 - entry.index : entry.index;
}

/** These exact cards as a hand of `type`, as pokerkit's `Hand(cards)`. */
export function handValue<T extends HandType>(
  type: T,
  cards: readonly KnownCard[]
): HandValue<T> | null {
  const rules = handRules[type];
  const table = lookup(rules.lookup);
  const entry = entryOf(table, cards);
  if (entry === null) return null;
  const strength = strengthOf(rules, table, entry);
  return { type, cards, category: entry.category, strength };
}

const candidatesByCounts = new Map<string, readonly (readonly number[])[]>();

/** Built once per hand type and card counts; never modified. */
function candidatesOf(
  type: HandType,
  holeCount: number,
  boardCount: number
): readonly (readonly number[])[] {
  const counts = `${type} ${holeCount} ${boardCount}`;
  const cached = candidatesByCounts.get(counts);
  if (cached !== undefined) return cached;
  const positions = Array.from(
    { length: holeCount + boardCount },
    (_, position) => position
  );
  const candidates = handRules[type].candidates(
    positions.slice(0, holeCount),
    positions.slice(holeCount)
  );
  candidatesByCounts.set(counts, candidates);
  return candidates;
}

type Best = {
  readonly positions: readonly number[];
  readonly entry: Entry;
  readonly strength: number;
};

/** The strongest hand of `type`; null if none forms or a card is not fully known. */
export function evaluate<T extends HandType>(
  type: T,
  hole: readonly Card[],
  board: readonly Card[]
): HandValue<T> | null {
  if (!hole.every(isKnownCard) || !board.every(isKnownCard)) return null;
  const rules = handRules[type];
  const table = lookup(rules.lookup);
  const cards = [...hole, ...board];
  const keys = cards.map(cardKeyOf);
  let best: Best | null = null;
  for (const positions of candidatesOf(type, hole.length, board.length)) {
    const entry = entryAt(table, keys, positions);
    if (entry === null) continue;
    const strength = strengthOf(rules, table, entry);
    if (best === null || strength > best.strength) {
      best = { positions, entry, strength };
    }
  }
  if (best === null) return null;
  return {
    type,
    // SAFETY: candidate positions index `cards`, whose counts built them.
    cards: best.positions.map((position) => cards[position] as KnownCard),
    category: best.entry.category,
    strength: best.strength,
  };
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
