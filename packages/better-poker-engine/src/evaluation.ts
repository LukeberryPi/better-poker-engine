import {
  cardOf,
  isKnownCard,
  rankOrders,
  suits,
  type Card,
  type KnownCard,
} from "./cards.ts";
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
  readonly cards: ReadonlyArray<KnownCard>;
  readonly category: HandCategory;
  /** Higher is stronger; only comparable within one hand type. */
  readonly strength: number;
};

/** Positions in `[...hole, ...board]` of each card set that may form a hand. */
type Candidates = (
  hole: ReadonlyArray<number>,
  board: ReadonlyArray<number>
) => Array<ReadonlyArray<number>>;

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

function strengthOf(rules: HandRules, table: Lookup, entry: Entry): number {
  return rules.low ? table.size - 1 - entry.index : entry.index;
}

/** These exact cards as a hand of `type`, as pokerkit's `Hand(cards)`. */
export function handValue<T extends HandType>(
  type: T,
  cards: ReadonlyArray<KnownCard>
): HandValue<T> | null {
  const rules = handRules[type];
  const table = lookup(rules.lookup);
  const entry = entryOf(table, cards);
  if (entry === null) {
    return null;
  }
  const strength = strengthOf(rules, table, entry);
  return { type, cards, category: entry.category, strength };
}

const candidatesByCounts = new Map<
  string,
  ReadonlyArray<ReadonlyArray<number>>
>();

/** Built once per hand type and card counts; never modified. */
function candidatesOf(
  type: HandType,
  holeCount: number,
  boardCount: number
): ReadonlyArray<ReadonlyArray<number>> {
  const counts = `${type} ${holeCount} ${boardCount}`;
  const cached = candidatesByCounts.get(counts);
  if (cached !== undefined) {
    return cached;
  }
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
  readonly positions: ReadonlyArray<number>;
  readonly entry: Entry;
  readonly strength: number;
};

/** The strongest hand of `type`; null if none forms or a card is not fully known. */
export function evaluate<T extends HandType>(
  type: T,
  hole: ReadonlyArray<Card>,
  board: ReadonlyArray<Card>
): HandValue<T> | null {
  if (!hole.every(isKnownCard) || !board.every(isKnownCard)) {
    return null;
  }
  const rules = handRules[type];
  const table = lookup(rules.lookup);
  const cards = [...hole, ...board];
  const keys = cards.map(cardKeyOf);
  let best: Best | null = null;
  for (const positions of candidatesOf(type, hole.length, board.length)) {
    const entry = entryAt(table, keys, positions);
    if (entry === null) {
      continue;
    }
    const strength = strengthOf(rules, table, entry);
    if (best === null || strength > best.strength) {
      best = { positions, entry, strength };
    }
  }
  if (best === null) {
    return null;
  }
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
  if (a.strength === b.strength) {
    return 0;
  }
  return a.strength > b.strength ? 1 : -1;
}

/** pokerkit's `str(hand)`, e.g. `Straight flush (6s7s8s9sTs)`. */
export function describeHand(value: HandValue): string {
  return `${categoryLabels[value.category]} (${value.cards.join("")})`;
}

type SevenCardTables = {
  /** By a card's character codes: its rank index, or -1. */
  readonly ranks: Int8Array;
  /** By a card's character codes: its suit index, or -1. */
  readonly suits: Int8Array;
  readonly primes: ReadonlyArray<number>;
  /** By the 13-bit rank mask of a suit holding five cards or more. */
  readonly flushes: Uint16Array;
  /** By the product of the seven cards' rank primes, when no suit holds five. */
  readonly others: ReadonlyMap<number, number>;
};

let sevenCardTables: SevenCardTables | null = null;

/** Visits each rank multiset of `size` cards, at most four of a rank, as rank indices;
 * `visit` must not keep the array, which the walk reuses. */
function forEachRankMultiset(
  size: number,
  visit: (ranks: ReadonlyArray<number>) => void
): void {
  const held: Array<number> = [];
  const walk = (from: number, left: number): void => {
    if (left === 0) {
      visit(held);
      return;
    }
    if (from === rankOrders.standard.length) {
      return;
    }
    for (let count = 0; count <= Math.min(4, left); count += 1) {
      for (let added = 0; added < count; added += 1) {
        held.push(from);
      }
      walk(from + 1, left - count);
      held.length -= count;
    }
  };
  walk(0, size);
}

/** Entry indices of five-card hands by their rank primes' product, suited or not. */
function fiveCardIndices(
  table: Lookup,
  primes: ReadonlyArray<number>,
  suited: boolean
): Map<number, number> {
  const indices = new Map<number, number>();
  const all = [0, 1, 2, 3, 4];
  forEachRankMultiset(5, (multiset) => {
    const keys = multiset.map((rank, position) => ({
      prime: primes[rank] ?? 0,
      suit: suited ? 1 : 1 << (position % 4),
    }));
    const entry = entryAt(table, keys, all);
    if (entry !== null) {
      indices.set(
        keys.reduce((product, key) => product * key.prime, 1),
        entry.index
      );
    }
  });
  return indices;
}

/** The best five of seven: each product less two of its primes is a five-card hand. */
function bestOfSeven(
  primes: ReadonlyArray<number>,
  fives: ReadonlyMap<number, number>
): number {
  const product = primes.reduce((total, prime) => total * prime, 1);
  let best = 0;
  for (let first = 0; first < primes.length; first += 1) {
    for (let second = first + 1; second < primes.length; second += 1) {
      const dropped = (primes[first] ?? 1) * (primes[second] ?? 1);
      best = Math.max(best, fives.get(product / dropped) ?? 0);
    }
  }
  return best;
}

/** Built once, from the lookup `evaluate` uses, so the two agree on every hand. */
function tablesForSevenCards(): SevenCardTables {
  if (sevenCardTables !== null) {
    return sevenCardTables;
  }
  const table = lookup("standard");
  const ranks = rankOrders.standard;
  const primes = ranks.map((rank) => cardKeyOf(cardOf(rank, "c")).prime);
  const suited = fiveCardIndices(table, primes, true);
  const unsuited = fiveCardIndices(table, primes, false);
  const flushes = new Uint16Array(1 << ranks.length);
  for (let mask = 0; mask < flushes.length; mask += 1) {
    const held = ranks.flatMap((_, rank) => ((mask >> rank) & 1 ? [rank] : []));
    if (held.length === 5) {
      const product = held.reduce(
        (total, rank) => total * (primes[rank] ?? 1),
        1
      );
      flushes[mask] = suited.get(product) ?? 0;
    } else if (held.length > 5 && held.length <= 7) {
      // Masks with one rank fewer are smaller numbers, so they are already filled in.
      for (const rank of held) {
        flushes[mask] = Math.max(
          flushes[mask] ?? 0,
          flushes[mask ^ (1 << rank)] ?? 0
        );
      }
    }
  }
  const others = new Map<number, number>();
  forEachRankMultiset(7, (multiset) => {
    const held = multiset.map((rank) => primes[rank] ?? 1);
    others.set(
      held.reduce((total, prime) => total * prime, 1),
      bestOfSeven(held, unsuited)
    );
  });
  const rankCodes = new Int8Array(128).fill(-1);
  for (const [rank, symbol] of ranks.entries()) {
    rankCodes[symbol.charCodeAt(0)] = rank;
  }
  const suitCodes = new Int8Array(128).fill(-1);
  for (const [suit, symbol] of suits.entries()) {
    suitCodes[symbol.charCodeAt(0)] = suit;
  }
  sevenCardTables = {
    ranks: rankCodes,
    suits: suitCodes,
    primes,
    flushes,
    others,
  };
  return sevenCardTables;
}

/** `evaluate(...)?.strength` without finding which five cards play. Seven-card
 * standard high hands, which equity simulations need, take one table lookup. */
export function evaluateStrength(
  type: HandType,
  hole: ReadonlyArray<Card>,
  board: ReadonlyArray<Card>
): number | null {
  if (type !== "standardHigh" || hole.length + board.length !== 7) {
    return evaluate(type, hole, board)?.strength ?? null;
  }
  const tables = tablesForSevenCards();
  let product = 1;
  let counts = 0;
  let lowSuits = 0;
  let highSuits = 0;
  for (let index = 0; index < 7; index += 1) {
    const card = index < hole.length ? hole[index] : board[index - hole.length];
    const rank = tables.ranks[card?.charCodeAt(0) ?? 0] ?? -1;
    const suit = tables.suits[card?.charCodeAt(1) ?? 0] ?? -1;
    if (rank === -1 || suit === -1) {
      return null;
    }
    product *= tables.primes[rank] ?? 1;
    counts += 1 << (suit * 3);
    if (suit < 2) {
      lowSuits |= 1 << (suit * 13 + rank);
    } else {
      highSuits |= 1 << ((suit - 2) * 13 + rank);
    }
  }
  for (let suit = 0; suit < 4; suit += 1) {
    if (((counts >> (suit * 3)) & 7) >= 5) {
      const suits = suit < 2 ? lowSuits : highSuits;
      return tables.flushes[(suits >> ((suit % 2) * 13)) & 0x1f_ff] ?? null;
    }
  }
  return tables.others.get(product) ?? null;
}
