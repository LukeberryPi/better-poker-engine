import { expect } from "bun:test";

import { doctest, unitTest } from "../../../../parity/harness.ts";
import type { DoctestId } from "../../../../parity/manifest.ts";
import {
  arePaired,
  areRainbow,
  areSuited,
  decks,
  type KnownCard,
} from "../../src/cards.ts";
import {
  categoryLabels,
  entryOf,
  lookup,
  type Entry,
  type HandCategory,
  type Lookup,
  type LookupName,
} from "../../src/lookups.ts";
import { cards, digestSortedByEntry, forEachCombination } from "../support.ts";

type Hand = readonly KnownCard[];

function entryIn(table: Lookup, text: string): Entry {
  const entry = entryOf(table, cards(text));
  if (entry === null) throw new Error(`${text} has no entry`);
  return entry;
}

function digestOfCombinations(
  name: LookupName,
  deck: Hand,
  size: number
): string {
  return digestSortedByEntry(lookup(name), (visit) =>
    forEachCombination(deck, size, visit)
  );
}

/** pokerkit's Badugi test: rainbow unpaired hands sort; paired or suited ones have no entry. */
function badugiDigest(name: LookupName, deck: Hand): string {
  const table = lookup(name);
  const badugis: Hand[] = [];
  const accepted: string[] = [];
  for (const size of [1, 2, 3, 4]) {
    forEachCombination(deck, size, (hand) => {
      if (!arePaired(hand) && areRainbow(hand)) {
        badugis.push(hand);
      } else if (arePaired(hand) || areSuited(hand)) {
        if (entryOf(table, hand) !== null) accepted.push(hand.join(""));
      }
    });
  }
  expect(accepted).toEqual([]);
  return digestSortedByEntry(table, (visit) => badugis.forEach(visit));
}

/** The seven examples each lookup class docstring has: two entries, an invalid hand. */
function lookupDoctest(
  id: DoctestId,
  name: LookupName,
  texts: readonly [string, string, string],
  order: -1 | 1,
  categories: readonly [HandCategory, HandCategory]
): void {
  const [first, second, invalid] = texts;
  doctest(id, (example) => {
    let table: Lookup;
    let e0: Entry;
    let e1: Entry;
    example(1, () => {
      table = lookup(name);
    });
    example(2, () => {
      e0 = entryIn(table, first);
    });
    example(3, () => {
      e1 = entryIn(table, second);
    });
    example(4, () => expect(entryOf(table, cards(invalid))).toBeNull());
    example(5, () => expect(Math.sign(e0.index - e1.index)).toBe(order));
    example(6, () => expect(e0.category).toBe(categories[0]));
    example(7, () => expect(e1.category).toBe(categories[1]));
  });
}

doctest("pokerkit.lookups.Label", (example) => {
  example(1, () => expect(categoryLabels.onePair).toBe("One pair"));
  example(2, () => expect(categoryLabels.fullHouse).toBe("Full house"));
});

// pokerkit builds Entry(0), Entry(1), Entry(1) by hand; these hands have those indices.
doctest("pokerkit.lookups.Entry", (example) => {
  const table = lookup("standard");
  let e0: Entry;
  let e1: Entry;
  let e2: Entry;
  example(1, () => {
    e0 = entryIn(table, "7c5d4h3s2c");
  });
  example(2, () => {
    e1 = entryIn(table, "7c6d4h3s2c");
  });
  example(3, () => {
    e2 = entryIn(table, "7d6c4h3s2c");
  });
  example(4, () => expect(e0.index).toBeLessThan(e1.index));
  example(5, () => expect(e1.index).not.toBeLessThan(e2.index));
  example(6, () => expect(e0.index).not.toBe(e1.index));
  example(7, () => expect(e1.index).toBe(e2.index));
  example(8, () => expect(e0.index).toBe(0));
  example(9, () => expect(e0.category).toBe("highCard"));
});

doctest("pokerkit.lookups.Lookup", (example) => {
  let table: Lookup;
  let e0: Entry;
  let e1: Entry;
  example(1, () => {
    table = lookup("standard");
  });
  example(2, () => {
    e0 = entryIn(table, "As3sQhJsJc");
  });
  example(3, () => {
    e1 = entryIn(table, "2s4sKhKsKc");
  });
  example(4, () => expect(e0.index).toBeLessThan(e1.index));
  example(5, () => expect(e0.category).toBe("onePair"));
  example(6, () => expect(e1.category).toBe("threeOfAKind"));
});

doctest("pokerkit.lookups.Lookup.has_entry", (example) => {
  let table: Lookup;
  example(1, () => {
    table = lookup("shortDeck");
  });
  example(2, () => expect(entryOf(table, cards("Ah6h7s8c9s"))).not.toBeNull());
  example(3, () => expect(entryOf(table, cards("Ah6h7s8c2s"))).toBeNull());
});

doctest("pokerkit.lookups.Lookup.get_entry", (example) => {
  let table: Lookup;
  let entry: Entry;
  example(1, () => {
    table = lookup("shortDeck");
  });
  example(2, () => {
    entry = entryIn(table, "Ah6h7s8c9s");
  });
  example(3, () => expect(entry.index).toBe(1128));
  example(4, () => expect(entry.category).toBe("straight"));
  example(5, () => expect(entryOf(table, cards("Ah6h7s8c2s"))).toBeNull());
});

doctest("pokerkit.lookups.Lookup.get_entry_or_none", (example) => {
  let table: Lookup;
  let entry: Entry | null;
  example(1, () => {
    table = lookup("shortDeck");
  });
  example(2, () => {
    entry = entryOf(table, cards("Ah6h7s8c2s"));
  });
  example(3, () => expect(entry).toBeNull());
});

lookupDoctest(
  "pokerkit.lookups.StandardLookup",
  "standard",
  ["Ah6h7s8c9s", "AhAc6s6hTd", "AcAdAhAsAc"],
  -1,
  ["highCard", "twoPair"]
);

lookupDoctest(
  "pokerkit.lookups.Standard2Lookup",
  "standard2",
  ["Ah6h7s8c9s", "AhAc6s6hTd", "AcAdAhAsAc"],
  -1,
  ["highCard", "twoPair"]
);

lookupDoctest(
  "pokerkit.lookups.ShortDeckHoldemLookup",
  "shortDeck",
  ["AhAc6s6hTd", "Ah6h7s8c9s", "Ah2h3s4c5s"],
  -1,
  ["twoPair", "straight"]
);

lookupDoctest(
  "pokerkit.lookups.RegularLookup",
  "regular",
  ["Ah6h7s8c9s", "AhAc6s6hTd", "3s4sQhTc"],
  -1,
  ["highCard", "twoPair"]
);

lookupDoctest(
  "pokerkit.lookups.BadugiLookup",
  "badugi",
  ["2s", "KhQc", "AcAdAhAs"],
  1,
  ["highCard", "highCard"]
);

lookupDoctest(
  "pokerkit.lookups.KuhnPokerLookup",
  "kuhn",
  ["J?", "Q?", "2?"],
  -1,
  ["highCard", "highCard"]
);

lookupDoctest(
  "pokerkit.lookups.LeducHoldemLookup",
  "leduc",
  ["JsQh", "KsKh", "QhTs"],
  -1,
  ["highCard", "onePair"]
);

lookupDoctest(
  "pokerkit.lookups.RhodeIslandHoldemLookup",
  "rhodeIsland",
  ["6s7h8c", "TsTdTh", "3h3c"],
  -1,
  ["straight", "threeOfAKind"]
);

lookupDoctest(
  "pokerkit.lookups.Numeral211HoldemLookup",
  "numeral211",
  ["6s7h8c", "TsTdTh", "3h3c"],
  -1,
  ["straight", "threeOfAKind"]
);

const largeTable = { timeout: 30_000 };

unitTest(
  "pokerkit.tests.test_lookups.StandardLookupTestCase.test_get_entry",
  () => {
    expect(digestOfCombinations("standard", decks.standard, 5)).toBe(
      "488cdd27873395ba75205cd02fb9d6b2"
    );
  },
  largeTable
);

unitTest(
  "pokerkit.tests.test_lookups.Standard2LookupTestCase.test_get_entry",
  () => {
    expect(digestOfCombinations("standard2", decks.standard, 5)).toBe(
      "3f1565279b892b21f843b9b038ced8f9"
    );
  },
  largeTable
);

unitTest(
  "pokerkit.tests.test_lookups.ShortDeckHoldemLookupTestCase.test_get_entry",
  () => {
    expect(digestOfCombinations("shortDeck", decks.shortDeck, 5)).toBe(
      "5b46b727ce4526a68d41b0e55939353c"
    );
  },
  largeTable
);

unitTest(
  "pokerkit.tests.test_lookups.EightOrBetterLookupTestCase.test_get_entry",
  () => {
    const table = lookup("eightOrBetter");
    const digest = digestSortedByEntry(table, (visit) =>
      forEachCombination(decks.regular, 5, (hand) => {
        if (entryOf(table, hand) !== null) visit(hand);
      })
    );
    expect(digest).toBe("ecf2b6b16031562a6761932b1ce1de91");
  },
  largeTable
);

unitTest(
  "pokerkit.tests.test_lookups.RegularLookupTestCase.test_get_entry",
  () => {
    expect(digestOfCombinations("regular", decks.regular, 5)).toBe(
      "28925b97b06a1e674eaabf241a441e15"
    );
  },
  largeTable
);

unitTest(
  "pokerkit.tests.test_lookups.BadugiLookupTestCase.test_get_entry",
  () => {
    expect(badugiDigest("badugi", decks.regular)).toBe(
      "9d29ddbc3f76d815e166c6faa2af9021"
    );
  },
  largeTable
);

unitTest(
  "pokerkit.tests.test_lookups.StandardBadugiLookupTestCase.test_get_entry",
  () => {
    expect(badugiDigest("standardBadugi", decks.standard)).toBe(
      "06886dd57a4c7b780953f5090c63bcfe"
    );
  },
  largeTable
);

unitTest(
  "pokerkit.tests.test_lookups.KuhnPokerLookupTestCase.test_get_entry",
  () => {
    expect(digestOfCombinations("kuhn", decks.kuhn, 1)).toBe(
      "bb7d5e9f8fe4f404fd1551d8995ca1a2"
    );
  }
);

unitTest(
  "pokerkit.tests.test_lookups.LeducHoldemLookupTestCase.test_get_entry",
  () => {
    expect(digestOfCombinations("leduc", decks.leduc, 2)).toBe(
      "12148ab771ed5520678f5d28fe65af00"
    );
  }
);

unitTest(
  "pokerkit.tests.test_lookups.RhodeIslandHoldemLookupTestCase.test_get_entry",
  () => {
    expect(digestOfCombinations("rhodeIsland", decks.standard, 3)).toBe(
      "fcf110834e2232b3303cb039dcdd024b"
    );
  }
);

unitTest(
  "pokerkit.tests.test_lookups.Numeral211LookupTestCase.test_get_entry",
  () => {
    expect(digestOfCombinations("numeral211", decks.numeral211, 3)).toBe(
      "69fdf0a3b86d2514e6fd335c4c59a90c"
    );
  }
);
