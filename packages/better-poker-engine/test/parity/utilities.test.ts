import { expect } from "bun:test";

import { doctest, unitTest } from "../../../../parity/harness.ts";
import {
  arePaired,
  areRainbow,
  areSuited,
  cardOf,
  decks,
  describeCard,
  parseCards,
  parseRank,
  parseSuit,
  rankNames,
  rankOf,
  rankOrders,
  rankSymbols,
  shuffle,
  suitNames,
  suitOf,
  suitSymbols,
  type Card,
  type CardParseError,
  type KnownCard,
  type RankSymbol,
  type SuitSymbol,
} from "../../src/cards.ts";
import { rakePot, splitChips } from "../../src/hand/pots.ts";
import { anteVector, perPosition } from "../../src/hand/setup.ts";
import { maxOrNull, minOrNull } from "../../src/hand/state.ts";
import { seededRandom } from "../../src/random.ts";
import { err, ok, type Result } from "../../src/result.ts";
import { cards, known } from "../support.ts";

function expectSameCards(deck: readonly KnownCard[], text: string): void {
  expect(deck.toSorted()).toEqual(known(text).toSorted());
}

doctest("pokerkit.utilities.Rank", (example) => {
  example(1, () => expect(rankSymbols).toContain("2"));
  example(2, () => expect(parseRank("2")).toBe("2"));
  example(3, () => expect(rankNames["2"]).toBe("DEUCE"));
  example(4, () => expect(rankOf("2c")).toBe("2"));
});

doctest("pokerkit.utilities.RankOrder", (example) => {
  example(1, () => expect(rankOrders.standard).toHaveLength(13));
  example(2, () => expect(rankOrders.standard[0]).toBe("2"));
  example(3, () => expect(rankOrders.standard.at(-1)).toBe("A"));
  example(4, () => expect(rankOrders.shortDeck).toHaveLength(9));
  example(5, () => expect(rankOrders.shortDeck[0]).toBe("6"));
  example(6, () => expect(rankOrders.shortDeck.at(-1)).toBe("A"));
  example(7, () => expect(rankOrders.regular).toHaveLength(13));
  example(8, () => expect(rankOrders.regular[0]).toBe("A"));
  example(9, () => expect(rankOrders.regular.at(-1)).toBe("K"));
  example(10, () => expect(rankOrders.eightOrBetter).toHaveLength(8));
  example(11, () => expect(rankOrders.eightOrBetter[0]).toBe("A"));
  example(12, () => expect(rankOrders.eightOrBetter.at(-1)).toBe("8"));
});

doctest("pokerkit.utilities.Suit", (example) => {
  example(1, () => expect(suitSymbols).toContain("c"));
  example(2, () => expect(parseSuit("c")).toBe("c"));
  example(3, () => expect(suitNames.c).toBe("CLUB"));
  example(4, () => expect(suitOf("Ac")).toBe("c"));
});

doctest("pokerkit.utilities.Card", (example) => {
  let card: KnownCard;
  example(1, () => {
    card = cardOf("A", "s");
  });
  example(2, () => expect(card).toBe("As"));
  example(3, () => expect(describeCard(card)).toBe("ACE OF SPADES (As)"));
  example(4, () => expect(rankOf(card)).toBe("A"));
  example(5, () => expect(suitOf(card)).toBe("s"));
  example(6, () => {
    expect(() => {
      // @ts-expect-error cards are immutable strings
      card[0] = "K";
    }).toThrow(TypeError);
  });
  example(7, () => {});
  example(8, () => expect(new Set([card, cardOf("A", "s")]).size).toBe(1));
});

doctest("pokerkit.utilities.Card.get_ranks", (example) => {
  let ranks: RankSymbol[];
  example(1, () => {
    ranks = cards("2sKh").map(rankOf);
  });
  example(2, () => expect(ranks).toEqual(["2", "K"]));
});

doctest("pokerkit.utilities.Card.get_suits", (example) => {
  let suits: SuitSymbol[];
  example(1, () => {
    suits = cards("2sKh").map(suitOf);
  });
  example(2, () => expect(suits).toEqual(["s", "h"]));
});

doctest("pokerkit.utilities.Card.are_paired", (example) => {
  example(1, () => expect(arePaired([])).toBe(false));
  example(2, () => expect(arePaired(cards("2sKh"))).toBe(false));
  example(3, () => expect(arePaired(cards("2sKh2h"))).toBe(true));
  example(4, () => expect(arePaired(cards("2s2c2h"))).toBe(true));
});

doctest("pokerkit.utilities.Card.are_suited", (example) => {
  example(1, () => expect(areSuited([])).toBe(true));
  example(2, () => expect(areSuited(cards("2s"))).toBe(true));
  example(3, () => expect(areSuited(cards("2sKh3s"))).toBe(false));
  example(4, () => expect(areSuited(cards("2hKh3h"))).toBe(true));
});

doctest("pokerkit.utilities.Card.are_rainbow", (example) => {
  example(1, () => expect(areRainbow([])).toBe(true));
  example(2, () => expect(areRainbow(cards("2s"))).toBe(true));
  example(3, () => expect(areRainbow(cards("2sKh3c"))).toBe(true));
  example(4, () => expect(areRainbow(cards("2hKh3c"))).toBe(false));
});

doctest("pokerkit.utilities.Card.clean", (example) => {
  let parsed: Result<readonly Card[], CardParseError>;
  example(1, () => {
    parsed = parseCards("AsKs");
    expect(parsed).toEqual(ok(["As", "Ks"]));
  });
  example(2, () => expect(parseCards("AsKs")).toEqual(parsed));
  example(3, () => expect(parseCards(cardOf("A", "s"))).toEqual(ok(["As"])));
  example(4, () => {
    expect(() => {
      // @ts-expect-error pokerkit rejects None; only text parses
      parseCards(null);
    }).toThrow(TypeError);
  });
});

doctest("pokerkit.utilities.Card.parse", (example) => {
  example(1, () => {
    expect(parseCards("AsKsQsJsTs")).toEqual(
      ok(["As", "Ks", "Qs", "Js", "Ts"])
    );
  });
  example(2, () => {
    expect(parseCards("2c8d5sKh")).toEqual(ok(["2c", "8d", "5s", "Kh"]));
  });
  example(3, () => {
    expect(parseCards("2c, 8d, 5s, Kh")).toEqual(ok(["2c", "8d", "5s", "Kh"]));
  });
  example(4, () => expect(cards("AcAh")[0]).toBe("Ac"));
  example(5, () => {
    expect(parseCards("AcA")).toEqual(
      err({ code: "invalid_card", at: 2, text: "A" })
    );
  });
  example(6, () => {
    expect(parseCards("1d")).toEqual(
      err({ code: "invalid_card", at: 0, text: "1d" })
    );
  });
  example(7, () => {
    expect(parseCards("Ax")).toEqual(
      err({ code: "invalid_card", at: 0, text: "Ax" })
    );
  });
});

doctest("pokerkit.utilities.Deck", (example) => {
  let deck: KnownCard[];
  example(1, () => expect(decks.standard).toHaveLength(52));
  example(2, () => {
    expect(decks.standard.slice(0, 6)).toEqual(known("2c2d2h2s3c3d"));
  });
  example(3, () => expect(decks.shortDeck).toHaveLength(36));
  example(4, () => {
    expect(decks.shortDeck.slice(0, 6)).toEqual(known("6c6d6h6s7c7d"));
  });
  example(5, () => {
    expect(() => {
      // @ts-expect-error decks are read-only
      decks.standard[3] = "As";
    }).toThrow(TypeError);
  });
  example(6, () => {
    deck = [...decks.standard];
  });
  example(7, () => {
    deck[3] = "As";
  });
  example(8, () => expect(deck.slice(0, 6)).toEqual(known("2c2d2hAs3c3d")));
  example(9, () => expect(decks.standard).toHaveLength(52));
  example(10, () => expect(decks.regular).toHaveLength(52));
  example(11, () => {
    expect(decks.standard.slice(0, 6)).toEqual(known("2c2d2h2s3c3d"));
  });
  example(12, () => {
    expect(decks.regular.slice(0, 6)).toEqual(known("AcAdAhAs2c2d"));
  });
});

doctest("pokerkit.utilities.shuffled", (example) => {
  let shuffled: readonly KnownCard[];
  example(1, () => {
    shuffled = shuffle(known("AcAdAhAs"), seededRandom(0));
  });
  example(2, () => expect(shuffled.map(rankOf)).toEqual(["A", "A", "A", "A"]));
});

doctest("pokerkit.utilities.clean_values", (example) => {
  example(1, () => {
    expect(perPosition([1, 2, 3, 4].entries(), 4)).toEqual([1, 2, 3, 4]);
  });
  example(2, () => {
    expect(perPosition([1, 2, 3, 4].entries(), 6)).toEqual([1, 2, 3, 4, 0, 0]);
  });
  example(3, () => {
    expect(
      perPosition(
        [
          [0, 1],
          [-1, 2],
        ],
        4
      )
    ).toEqual([1, 0, 0, 2]);
  });
  example(4, () => {
    expect(anteVector({ kind: "everyone", amount: 4 }, 4)).toEqual([
      4, 4, 4, 4,
    ]);
  });
  example(5, () => {
    expect(perPosition([1, 2, 3].entries(), 2)).toEqual([1, 2]);
  });
  example(6, () => {
    // @ts-expect-error amounts are required
    expect(() => perPosition(null, 2)).toThrow(TypeError);
  });
});

const tenPercent = {
  kind: "percentage",
  basisPoints: 1000,
  cap: null,
  noFlopNoDrop: false,
} as const;
const elevenPercent = { ...tenPercent, basisPoints: 1100 };

doctest("pokerkit.utilities.rake", (example) => {
  example(1, () => {
    expect(rakePot(100, { kind: "none" }, true)).toEqual({
      raked: 0,
      unraked: 100,
    });
  });
  example(2, () => {
    expect(rakePot(1000, tenPercent, true)).toEqual({
      raked: 100,
      unraked: 900,
    });
  });
  example(3, () => {
    expect(rakePot(10, elevenPercent, true)).toEqual({ raked: 1, unraked: 9 });
  });
  example(4, () => {
    expect(rakePot(10.0, elevenPercent, true)).toEqual({
      raked: 1,
      unraked: 9,
    });
  });
  example(5, () => {
    expect(rakePot(10.0, { ...elevenPercent, cap: 1.0 }, true)).toEqual({
      raked: 1.0,
      unraked: 9.0,
    });
  });
  example(6, () => {
    // @ts-expect-error no-flop-no-drop needs to know whether the flop was dealt
    rakePot(100, { ...tenPercent, noFlopNoDrop: true });
  });
});

doctest("pokerkit.utilities.divmod", (example) => {
  example(1, () => expect(splitChips(11, 3)).toEqual([3, 2]));
  example(2, () => expect(splitChips(11.0, 3)).toEqual([3, 2]));
});

const identity = (value: number) => value;

doctest("pokerkit.utilities.min_or_none", (example) => {
  example(1, () => expect(minOrNull([1, 2, 3, -2, -1], identity)).toBe(-2));
  example(2, () => {
    expect(minOrNull([1, null, 2, null, 3, -2, -1, null], identity)).toBe(-2);
  });
  example(3, () => expect(minOrNull([], identity)).toBeNull());
});

doctest("pokerkit.utilities.max_or_none", (example) => {
  example(1, () => expect(maxOrNull([1, 2, 3, -2, -1], identity)).toBe(3));
  example(2, () => {
    expect(maxOrNull([1, null, 2, null, 3, -2, -1, null], identity)).toBe(3);
  });
  example(3, () => expect(maxOrNull([], identity)).toBeNull());
});

unitTest("pokerkit.tests.test_utilities.RankTestCase.test_members", () => {
  expect(rankSymbols.join("")).toBe("A23456789TJQK?");
});

unitTest("pokerkit.tests.test_utilities.RankOrderTestCase.test_members", () => {
  expect(rankOrders.standard.join("")).toBe("23456789TJQKA");
  expect(rankOrders.shortDeck.join("")).toBe("6789TJQKA");
  expect(rankOrders.regular.join("")).toBe("A23456789TJQK");
  expect(rankOrders.eightOrBetter.join("")).toBe("A2345678");
  expect(rankOrders.kuhn.join("")).toBe("JQK");
  expect(rankOrders.numeral211.join("")).toBe("23456789TA");
  expect(rankOrders.royal.join("")).toBe("TJQKA");
});

unitTest("pokerkit.tests.test_utilities.SuitTestCase.test_members", () => {
  expect(suitSymbols.join("")).toBe("cdhs?");
});

unitTest("pokerkit.tests.test_utilities.DeckTestCase.test_members", () => {
  expect(decks.standard).toHaveLength(52);
  expectSameCards(
    decks.standard,
    "2c3c4c5c6c7c8c9cTcJcQcKcAc 2d3d4d5d6d7d8d9dTdJdQdKdAd " +
      "2h3h4h5h6h7h8h9hThJhQhKhAh 2s3s4s5s6s7s8s9sTsJsQsKsAs"
  );
  expect(decks.shortDeck).toHaveLength(36);
  expectSameCards(
    decks.shortDeck,
    "6c7c8c9cTcJcQcKcAc 6d7d8d9dTdJdQdKdAd 6h7h8h9hThJhQhKhAh 6s7s8s9sTsJsQsKsAs"
  );
  expect(decks.regular).toHaveLength(52);
  // pokerkit compares STANDARD here, not REGULAR.
  expectSameCards(
    decks.standard,
    "Ac2c3c4c5c6c7c8c9cTcJcQcKc Ad2d3d4d5d6d7d8d9dTdJdQdKd " +
      "Ah2h3h4h5h6h7h8h9hThJhQhKh As2s3s4s5s6s7s8s9sTsJsQsKs"
  );
  expect(decks.kuhn).toHaveLength(3);
  expectSameCards(decks.kuhn, "JsQsKs");
  expect(decks.leduc).toHaveLength(6);
  expectSameCards(decks.leduc, "JhJsQhQsKhKs");
  expect(decks.numeral211).toHaveLength(40);
  expectSameCards(
    decks.numeral211,
    "2c3c4c5c6c7c8c9cTcAc 2d3d4d5d6d7d8d9dTdAd 2h3h4h5h6h7h8h9hThAh 2s3s4s5s6s7s8s9sTsAs"
  );
  expect(decks.royal).toHaveLength(20);
  expectSameCards(decks.royal, "TcTdThTsJcJdJhJsQcQdQhQsKcKdKhKsAcAdAhAs");
});
