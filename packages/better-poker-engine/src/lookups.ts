import {
  areRainbow,
  areSuited,
  rankOf,
  rankOrders,
  type Card,
  type Rank,
} from "./cards.ts";
import { combinations } from "./combinations.ts";

export type HandCategory =
  | "highCard"
  | "onePair"
  | "twoPair"
  | "threeOfAKind"
  | "straight"
  | "flush"
  | "fullHouse"
  | "fourOfAKind"
  | "straightFlush";

/** pokerkit's `Label` values. */
export const categoryLabels = {
  highCard: "High card",
  onePair: "One pair",
  twoPair: "Two pair",
  threeOfAKind: "Three of a kind",
  straight: "Straight",
  flush: "Flush",
  fullHouse: "Full house",
  fourOfAKind: "Four of a kind",
  straightFlush: "Straight flush",
} as const satisfies Record<HandCategory, string>;

/** A hand class; within a lookup, `index` orders classes as pokerkit's `Entry`. */
export type Entry = { readonly index: number; readonly category: HandCategory };

export type Lookup = {
  readonly entries: ReadonlyMap<number, Entry>;
  /** Indices run from 0 to `size - 1` without gaps. */
  readonly size: number;
  readonly badugi: boolean;
};

type Suitedness = "suited" | "unsuited" | "either";

type Step =
  | {
      readonly kind: "multisets";
      readonly category: HandCategory;
      /** Sizes of the groups of equal ranks, e.g. `[2, 2, 1]` for two pair. */
      readonly pattern: readonly number[];
      readonly suitedness: Suitedness;
    }
  | {
      readonly kind: "straights";
      readonly category: HandCategory;
      readonly length: number;
      readonly suitedness: Suitedness;
      /** Whether the top rank also plays below the bottom one, as in A2345. */
      readonly wrap: boolean;
    };

type LookupDefinition = {
  readonly rankOrder: readonly Rank[];
  /** Each step adds hand classes after the previous ones, as pokerkit's `_add_entries`. */
  readonly steps: readonly Step[];
  /** Badugi hands need distinct ranks and distinct suits. */
  readonly badugi: boolean;
};

function multisets(
  category: HandCategory,
  pattern: readonly number[],
  suitedness: Suitedness
): Step {
  return { kind: "multisets", category, pattern, suitedness };
}

function straights(
  category: HandCategory,
  length: number,
  suitedness: Suitedness,
  wrap = true
): Step {
  return { kind: "straights", category, length, suitedness, wrap };
}

function standardSteps(wrap: boolean): Step[] {
  return [
    multisets("highCard", [1, 1, 1, 1, 1], "unsuited"),
    multisets("onePair", [2, 1, 1, 1], "unsuited"),
    multisets("twoPair", [2, 2, 1], "unsuited"),
    multisets("threeOfAKind", [3, 1, 1], "unsuited"),
    straights("straight", 5, "unsuited", wrap),
    multisets("flush", [1, 1, 1, 1, 1], "suited"),
    multisets("fullHouse", [3, 2], "unsuited"),
    multisets("fourOfAKind", [4, 1], "unsuited"),
    straights("straightFlush", 5, "suited", wrap),
  ];
}

const shortDeckSteps = [
  multisets("highCard", [1, 1, 1, 1, 1], "unsuited"),
  multisets("onePair", [2, 1, 1, 1], "unsuited"),
  multisets("twoPair", [2, 2, 1], "unsuited"),
  multisets("threeOfAKind", [3, 1, 1], "unsuited"),
  straights("straight", 5, "unsuited"),
  multisets("fullHouse", [3, 2], "unsuited"),
  multisets("flush", [1, 1, 1, 1, 1], "suited"),
  multisets("fourOfAKind", [4, 1], "unsuited"),
  straights("straightFlush", 5, "suited"),
];

const regularSteps = [
  multisets("highCard", [1, 1, 1, 1, 1], "either"),
  multisets("onePair", [2, 1, 1, 1], "unsuited"),
  multisets("twoPair", [2, 2, 1], "unsuited"),
  multisets("threeOfAKind", [3, 1, 1], "unsuited"),
  multisets("fullHouse", [3, 2], "unsuited"),
  multisets("fourOfAKind", [4, 1], "unsuited"),
];

const badugiSteps = [
  multisets("highCard", [1, 1, 1, 1], "unsuited"),
  multisets("highCard", [1, 1, 1], "unsuited"),
  multisets("highCard", [1, 1], "unsuited"),
  multisets("highCard", [1], "suited"),
];

const rhodeIslandSteps = [
  multisets("highCard", [1, 1, 1], "unsuited"),
  multisets("onePair", [2, 1], "unsuited"),
  multisets("flush", [1, 1, 1], "suited"),
  straights("straight", 3, "unsuited"),
  multisets("threeOfAKind", [3], "unsuited"),
  straights("straightFlush", 3, "suited"),
];

/** Up cards on show in stud, from one to four of them. */
const openingSteps = [
  multisets("highCard", [1], "either"),
  multisets("highCard", [1, 1], "either"),
  multisets("highCard", [1, 1, 1], "either"),
  multisets("highCard", [1, 1, 1, 1], "either"),
  multisets("onePair", [2], "unsuited"),
  multisets("onePair", [2, 1], "unsuited"),
  multisets("onePair", [2, 1, 1], "unsuited"),
  multisets("twoPair", [2, 2], "unsuited"),
  multisets("threeOfAKind", [3], "unsuited"),
  multisets("threeOfAKind", [3, 1], "unsuited"),
  multisets("fourOfAKind", [4], "unsuited"),
];

/** pokerkit's lookup classes, keyed by their names without `Lookup`. */
export const definitions = {
  standard: {
    rankOrder: rankOrders.standard,
    steps: standardSteps(true),
    badugi: false,
  },
  standard2: {
    rankOrder: rankOrders.standard,
    steps: standardSteps(false),
    badugi: false,
  },
  shortDeck: {
    rankOrder: rankOrders.shortDeck,
    steps: shortDeckSteps,
    badugi: false,
  },
  eightOrBetter: {
    rankOrder: rankOrders.eightOrBetter,
    steps: [multisets("highCard", [1, 1, 1, 1, 1], "either")],
    badugi: false,
  },
  regular: {
    rankOrder: rankOrders.regular,
    steps: regularSteps,
    badugi: false,
  },
  badugi: { rankOrder: rankOrders.regular, steps: badugiSteps, badugi: true },
  standardBadugi: {
    rankOrder: rankOrders.standard,
    steps: badugiSteps,
    badugi: true,
  },
  kuhn: {
    rankOrder: rankOrders.kuhn,
    steps: [multisets("highCard", [1], "suited")],
    badugi: false,
  },
  leduc: {
    rankOrder: rankOrders.kuhn,
    steps: [
      multisets("highCard", [1, 1], "either"),
      multisets("onePair", [2], "either"),
    ],
    badugi: false,
  },
  rhodeIsland: {
    rankOrder: rankOrders.standard,
    steps: rhodeIslandSteps,
    badugi: false,
  },
  numeral211: {
    rankOrder: rankOrders.numeral211,
    steps: rhodeIslandSteps,
    badugi: false,
  },
  lowHandOpening: {
    rankOrder: rankOrders.regular,
    steps: openingSteps,
    badugi: false,
  },
  highHandOpening: {
    rankOrder: rankOrders.standard,
    steps: openingSteps,
    badugi: false,
  },
} satisfies Record<string, LookupDefinition>;

export type LookupName = keyof typeof definitions;

const primes = {
  A: 2,
  "2": 3,
  "3": 5,
  "4": 7,
  "5": 11,
  "6": 13,
  "7": 17,
  "8": 19,
  "9": 23,
  T: 29,
  J: 31,
  Q: 37,
  K: 41,
} satisfies Record<Rank, number>;

const suitednessFlags = {
  suited: [true],
  unsuited: [false],
  either: [false, true],
} satisfies Record<Suitedness, readonly boolean[]>;

/** Two hands share a key when their ranks form the same multiset and suitedness. */
function keyOf(rankProduct: number, suited: boolean): number {
  return rankProduct * 2 + (suited ? 1 : 0);
}

function productOf(ranks: readonly Rank[]): number {
  return ranks.reduce((product, rank) => product * primes[rank], 1);
}

type Group = { readonly multiplicity: number; readonly count: number };

function groupsOf(pattern: readonly number[]): Group[] {
  return [...new Set(pattern)]
    .sort((a, b) => b - a)
    .map((multiplicity) => ({
      multiplicity,
      count: pattern.filter((size) => size === multiplicity).length,
    }));
}

/** pokerkit's `__hash_multisets`: highest groups first, top ranks first. */
function multisetProducts(
  ranks: readonly Rank[],
  groups: readonly Group[]
): number[] {
  const [group, ...rest] = groups;
  if (group === undefined) return [1];
  return combinations(ranks.toReversed(), group.count).flatMap((sample) => {
    const product = productOf(sample) ** group.multiplicity;
    const remaining = ranks.filter((rank) => !sample.includes(rank));
    return multisetProducts(remaining, rest).map(
      (partial) => product * partial
    );
  });
}

function rankProducts(step: Step, rankOrder: readonly Rank[]): number[] {
  if (step.kind === "multisets") {
    return multisetProducts(rankOrder, groupsOf(step.pattern)).toReversed();
  }
  const runs = Array.from(
    { length: rankOrder.length - step.length + 1 },
    (_, start) => rankOrder.slice(start, start + step.length)
  );
  const wheel = [
    ...rankOrder.slice(-1),
    ...rankOrder.slice(0, step.length - 1),
  ];
  return (step.wrap ? [wheel, ...runs] : runs).map(productOf);
}

/** A later step overwrites keys it shares with earlier ones; indices close up after. */
function build(definition: LookupDefinition): Lookup {
  const drafts = new Map<
    number,
    { index: number; readonly category: HandCategory }
  >();
  let added = 0;
  for (const step of definition.steps) {
    for (const product of rankProducts(step, definition.rankOrder)) {
      const draft = { index: added, category: step.category };
      added += 1;
      for (const suited of suitednessFlags[step.suitedness]) {
        drafts.set(keyOf(product, suited), draft);
      }
    }
  }
  const classes = [...new Set(drafts.values())].sort(
    (a, b) => a.index - b.index
  );
  classes.forEach((draft, index) => {
    draft.index = index;
  });
  return { entries: drafts, size: classes.length, badugi: definition.badugi };
}

const built = new Map<LookupName, Lookup>();

/** Built on first use, as all tables together take about 30 ms; never modified. */
export function lookup(name: LookupName): Lookup {
  const cached = built.get(name);
  if (cached !== undefined) return cached;
  const table = build(definitions[name]);
  built.set(name, table);
  return table;
}

/** pokerkit's `Lookup.get_entry_or_none`: null when the cards form no hand. */
export function entryOf(table: Lookup, cards: readonly Card[]): Entry | null {
  if (table.badugi && !areRainbow(cards)) return null;
  let product = 1;
  for (const card of cards) {
    const rank = rankOf(card);
    if (rank === "?") return null;
    product *= primes[rank];
  }
  return table.entries.get(keyOf(product, areSuited(cards))) ?? null;
}
