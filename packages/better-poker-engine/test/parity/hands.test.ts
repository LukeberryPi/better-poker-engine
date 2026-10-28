import { expect } from "bun:test";

import { doctest, type Example } from "../../../../parity/harness.ts";
import type { Card } from "../../src/cards.ts";
import {
  compareHands,
  describeHand,
  evaluate,
  handValue,
  type HandType,
  type HandValue,
} from "../../src/evaluation.ts";
import { cards, known } from "../support.ts";

function hand<T extends HandType>(type: T, text: string): HandValue<T> {
  const value = handValue(type, known(text));
  if (value === null) throw new Error(`${text} is no ${type} hand`);
  return value;
}

function best<T extends HandType>(
  type: T,
  hole: string,
  board = ""
): HandValue<T> {
  const value = evaluate(type, cards(hole), cards(board));
  if (value === null) throw new Error(`${hole} ${board} make no ${type} hand`);
  return value;
}

function expectAscending<T extends HandType>(
  values: readonly HandValue<T>[]
): void {
  values.reduce((weaker, stronger) => {
    expect(compareHands(weaker, stronger)).toBe(-1);
    return stronger;
  });
}

/** `h0 = Hand(…)` examples from `first`, then their `h0 < h1 < …` example. */
function ascendingHands<T extends HandType>(
  example: Example,
  first: number,
  type: T,
  texts: readonly string[]
): readonly HandValue<T>[] {
  const values: HandValue<T>[] = [];
  texts.forEach((text, offset) => {
    example(first + offset, () => {
      values.push(hand(type, text));
    });
  });
  example(first + texts.length, () => expectAscending(values));
  return values;
}

function invalidHands(
  example: Example,
  first: number,
  type: HandType,
  texts: readonly string[]
): void {
  texts.forEach((text, offset) => {
    example(first + offset, () => {
      expect(handValue(type, known(text))).toBeNull();
    });
  });
}

/** `h0 = from_game(hole, board)`, `h1 = Hand(text)`, `h0 == h1` from `first`. */
function fromGame<T extends HandType>(
  example: Example,
  first: number,
  type: T,
  [hole, board]: readonly [string, string],
  text: string
): void {
  let h0: HandValue<T>;
  let h1: HandValue<T>;
  example(first, () => {
    h0 = best(type, hole, board);
  });
  example(first + 1, () => {
    h1 = hand(type, text);
  });
  example(first + 2, () => expect(compareHands(h0, h1)).toBe(0));
}

doctest("pokerkit.hands.Hand", (example) => {
  let h0: HandValue<"shortDeckHigh">;
  let h1: HandValue<"shortDeckHigh">;
  let h3: HandValue<"badugi">;
  let h0Again: HandValue<"shortDeckHigh">;
  let h1Again: HandValue<"shortDeckHigh">;
  example(1, () => {
    h0 = hand("shortDeckHigh", "6s7s8s9sTs");
  });
  example(2, () => {
    h1 = hand("shortDeckHigh", "7c8c9cTcJc");
  });
  example(3, () => {
    expect(handValue("shortDeckHigh", known("2c2d2h2s3h"))).toBeNull();
  });
  example(4, () => expect(h0.cards).toEqual(known("6s7s8s9sTs")));
  example(5, () => expect(h1.cards).toEqual(known("7c8c9cTcJc")));
  example(6, () => {
    expect(describeHand(h0)).toBe("Straight flush (6s7s8s9sTs)");
  });
  example(7, () => expect(compareHands(h0, h1)).toBe(-1));
  example(8, () => {
    h3 = hand("badugi", "6d7s8h9c");
  });
  example(9, () => {
    // @ts-expect-error hands of different types do not compare
    compareHands(h3, h0);
  });
  example(10, () => {
    // @ts-expect-error a hand does not compare with a number
    compareHands(h3, 500);
  });
  example(11, () => {
    h0Again = hand("shortDeckHigh", "6s7s8s9sTs");
    expect(h0Again).toEqual(h0);
  });
  example(12, () => {
    h1Again = hand("shortDeckHigh", "7c8c9cTcJc");
    expect(h1Again).toEqual(h1);
  });
  example(13, () => {
    const hands = [h0, h1, h0Again, h1Again];
    expect(new Set(hands.map((value) => value.strength)).size).toBe(2);
  });
});

doctest("pokerkit.hands.Hand.cards", (example) => {
  let hole: Card[];
  let board: Card[];
  let value: HandValue<"standardHigh"> | null;
  example(1, () => {
    hole = cards("AsAc");
  });
  example(2, () => {
    board = cards("Kh3sAdAh");
  });
  example(3, () => {
    value = evaluate("standardHigh", hole, board);
  });
  example(4, () => expect(value?.cards).toEqual(known("AsAcKhAdAh")));
});

doctest("pokerkit.hands.Hand.entry", (example) => {
  let hole: Card[];
  let board: Card[];
  let value: HandValue<"standardHigh"> | null;
  example(1, () => {
    hole = cards("AsAc");
  });
  example(2, () => {
    board = cards("Kh3sAdAh");
  });
  example(3, () => {
    value = evaluate("standardHigh", hole, board);
  });
  example(4, () => expect(value?.category).toBe("fourOfAKind"));
});

doctest("pokerkit.hands.CombinationHand.from_game", (example) => {
  fromGame(example, 1, "standardHigh", ["AcAdAhAsKc", ""], "AcAdAhAsKc");
  fromGame(example, 4, "standardHigh", ["Ac9c", "AhKhQhJhTh"], "AhKhQhJhTh");
  fromGame(example, 7, "standardLow", ["AcAdAhAsKc", ""], "AcAdAhAsKc");
  fromGame(example, 10, "standardLow", ["Ac9c", "AhKhQhJhTh"], "AcQhJhTh9c");
  fromGame(example, 13, "shortDeckHigh", ["AcKs", "AhAsKcJsTs"], "AcAhAsKcKs");
  fromGame(example, 16, "shortDeckHigh", ["AcAd", "6s7cKcKd"], "AcAdKcKd7c");
  fromGame(
    example,
    19,
    "eightOrBetterLow",
    ["As2s", "2c3c4c5c6c"],
    "Ad2d3d4d5d"
  );
  fromGame(example, 22, "regularLow", ["AcAd", "AhAsKcQdQh"], "AcAsQdQhKc");
  fromGame(example, 25, "regularLow", ["AcAd", "AhAsKcQd"], "AdAhAsKcQd");
  fromGame(example, 28, "kuhn", ["Ks", ""], "Ks");
  fromGame(example, 31, "rhodeIsland", ["Ks", "QdAh"], "KsQdAh");
});

doctest("pokerkit.hands.StandardHighHand", (example) => {
  ascendingHands(example, 1, "standardHigh", [
    "7c5d4h3s2c",
    "7c6d4h3s2c",
    "8c7d6h4s2c",
    "AcAsAd2s4s",
    "TsJsQsKsAs",
  ]);
  invalidHands(example, 7, "standardHigh", ["4c5dThJsAcKh2h", "Ac2c3c4c", ""]);
});

doctest("pokerkit.hands.StandardLowHand", (example) => {
  ascendingHands(example, 1, "standardLow", [
    "TsJsQsKsAs",
    "AcAsAd2s4s",
    "8c7d6h4s2c",
    "7c6d4h3s2c",
    "7c5d4h3s2c",
  ]);
  const lows = ascendingHands(example, 7, "standardLow", [
    "2c2d7h8s9c",
    "Ac2d3h4s5c",
    "Kc5d4h3s2c",
  ]);
  [
    "One pair (2c2d7h8s9c)",
    "High card (Ac2d3h4s5c)",
    "High card (Kc5d4h3s2c)",
  ].forEach((text, offset) => {
    example(11 + offset, () => {
      expect(lows.map(describeHand)[offset]).toBe(text);
    });
  });
  invalidHands(example, 14, "standardLow", ["4c5dThJsAcKh2h", "Ac2c3c4c", ""]);
});

doctest("pokerkit.hands.ShortDeckHoldemHand", (example) => {
  ascendingHands(example, 1, "shortDeckHigh", [
    "6c7d8h9sJc",
    "7c7d7hTsQc",
    "As6c7h8h9h",
    "AsAhKcKhKd",
    "6s7s8sTsQs",
  ]);
  invalidHands(example, 7, "shortDeckHigh", [
    "4c5dThJsAcKh2h",
    "Ac2c3c4c5c",
    "",
  ]);
});

doctest("pokerkit.hands.EightOrBetterLowHand", (example) => {
  ascendingHands(example, 1, "eightOrBetterLow", [
    "8c7d6h4s2c",
    "7c5d4h3s2c",
    "5d4h3s2dAd",
  ]);
  invalidHands(example, 5, "eightOrBetterLow", [
    "AcAsAd2s4s",
    "TsJsQsKsAs",
    "4c5dThJsAcKh2h",
    "Ac2c3c4c",
    "",
  ]);
});

doctest("pokerkit.hands.RegularLowHand", (example) => {
  ascendingHands(example, 1, "regularLow", [
    "KhKsKcKdAc",
    "2s2c3s3cAh",
    "6c4d3h2sAc",
    "Ac2c3c4c5c",
  ]);
  invalidHands(example, 6, "regularLow", ["4c5dThJsAcKh2h", ""]);
});

doctest("pokerkit.hands.BoardCombinationHand.from_game", (example) => {
  fromGame(example, 1, "greekHigh", ["Ac2d", "QdJdTh2sKs"], "2s2dAcKsQd");
  fromGame(example, 4, "greekHigh", ["AsKs", "QdJdTh2s2d"], "AsKsQdJdTh");
  fromGame(example, 7, "greekHigh", ["Ac9c", "AhKhQhJhTh"], "AcAhKhQh9c");
});

doctest("pokerkit.hands.GreekHoldemHand", (example) => {
  ascendingHands(example, 1, "greekHigh", [
    "7c5d4h3s2c",
    "7c6d4h3s2c",
    "8c7d6h4s2c",
    "AcAsAd2s4s",
    "TsJsQsKsAs",
  ]);
});

doctest("pokerkit.hands.HoleBoardCombinationHand.from_game", (example) => {
  fromGame(example, 1, "omahaHigh", ["6c7c8c9c", "8s9sTc"], "6c7c8s9sTc");
  fromGame(example, 4, "omahaHigh", ["6c7c8s9s", "8c9cTc"], "6c7c8c9cTc");
  fromGame(example, 7, "omahaHigh", ["6c7c8c9c", "8s9sTc9hKs"], "8c8s9c9s9h");
  fromGame(example, 10, "omahaHigh", ["6c7c8sAh", "As9cTc2sKs"], "AhAsKsTc8s");
  fromGame(
    example,
    13,
    "omahaEightOrBetterLow",
    ["As2s3s4s", "2c3c4c5c6c"],
    "Ad2d3d4d5d"
  );
  fromGame(
    example,
    16,
    "omahaEightOrBetterLow",
    ["As6s7s8s", "2c3c4c5c6c"],
    "Ad2d3d4d6d"
  );
});

doctest("pokerkit.hands.OmahaHoldemHand", (example) => {
  ascendingHands(example, 1, "omahaHigh", [
    "7c5d4h3s2c",
    "7c6d4h3s2c",
    "8c7d6h4s2c",
    "AcAsAd2s4s",
    "TsJsQsKsAs",
  ]);
});

doctest("pokerkit.hands.OmahaEightOrBetterLowHand", (example) => {
  ascendingHands(example, 1, "omahaEightOrBetterLow", [
    "8c7d6h4s2c",
    "7c5d4h3s2c",
    "5d4h3s2dAd",
  ]);
});

doctest("pokerkit.hands.BadugiHand", (example) => {
  ascendingHands(example, 1, "badugi", [
    "Kc",
    "Ac",
    "4c8dKh",
    "Ac2d3h5s",
    "Ac2d3h4s",
  ]);
  invalidHands(example, 7, "badugi", [
    "Ac2d3c4s5c",
    "Ac2d3c4s",
    "AcAd3h4s",
    "Ac2c",
    "",
  ]);
});

doctest("pokerkit.hands.BadugiHand.from_game", (example) => {
  fromGame(example, 1, "badugi", ["2s4c5d6h", ""], "2s4c5d6h");
  fromGame(example, 4, "badugi", ["2s3s4d7h", ""], "2s4d7h");
  fromGame(example, 7, "badugi", ["KcKdKhKs", ""], "Ks");
  fromGame(example, 10, "badugi", ["Ac2c3c4c", ""], "Ac");
  fromGame(example, 13, "badugi", ["AcAdAhAs", ""], "As");
  fromGame(example, 16, "standardBadugi", ["Ac2c3c4c", ""], "2c");
  let h0: HandValue<"standardBadugi">;
  let h1: HandValue<"standardBadugi">;
  example(19, () => {
    h0 = best("standardBadugi", "2s3d3c4d");
  });
  example(20, () => {
    h1 = best("standardBadugi", "2s3c3d4d");
  });
  example(21, () => expect(compareHands(h0, h1)).toBe(0));
});

doctest("pokerkit.hands.KuhnPokerHand", (example) => {
  ascendingHands(example, 1, "kuhn", ["Js", "Qs", "Ks"]);
  invalidHands(example, 5, "kuhn", ["As"]);
});

doctest("pokerkit.hands.LeducHoldemHand", (example) => {
  ascendingHands(example, 1, "leduc", ["JsQs", "KsJc", "JhJs", "KsKh"]);
  invalidHands(example, 6, "leduc", ["Ks"]);
});

doctest("pokerkit.hands.RhodeIslandHoldemHand", (example) => {
  ascendingHands(example, 1, "rhodeIsland", [
    "JsJc2h",
    "2sQsAs",
    "KcQdAh",
    "3s3c3h",
  ]);
  invalidHands(example, 6, "rhodeIsland", ["AsKh"]);
});

doctest("pokerkit.hands.Numeral211HoldemHand", (example) => {
  ascendingHands(example, 1, "numeral211", [
    "Ts8h6c",
    "TsTh8c",
    "Ts8s6s",
    "Ts9h8c",
    "TsThTc",
    "Ts9s8s",
  ]);
  invalidHands(example, 8, "numeral211", ["JsJc2h"]);
});
