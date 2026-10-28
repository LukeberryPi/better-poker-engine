import { expect } from "bun:test";

import { doctest, unitTest } from "../../../../parity/harness.ts";
import { equities, handStrength, type Range } from "../../src/analysis.ts";
import { decks, type KnownCard } from "../../src/cards.ts";
import {
  compareHands,
  evaluate,
  type HandType,
  type HandValue,
} from "../../src/evaluation.ts";
import { seededRandom } from "../../src/random.ts";
import { ok } from "../../src/result.ts";
import { known, okValue, range, sortedCombos } from "../support.ts";

/** pokerkit's `2, 5, Deck.STANDARD, (StandardHighHand,)` arguments. */
const holdem = {
  holeCount: 2,
  boardCount: 5,
  deck: decks.standard,
  handTypes: ["standardHigh"],
} as const;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function fromGame<T extends HandType>(
  type: T,
  hole: readonly KnownCard[],
  board: readonly KnownCard[]
): HandValue<T> {
  const value = evaluate(type, hole, board);
  if (value === null) throw new Error(`${hole} ${board} make no ${type} hand`);
  return value;
}

/** pokerkit's `frozenset(Card.parse(text)) in rng`. */
function contains(rng: Range, text: string): boolean {
  const combos = sortedCombos(rng);
  return sortedCombos([known(text)]).every((combo) => combos.includes(combo));
}

/** pokerkit's `assertSetEqual` on a range and its combinations. */
function expectCombos(actual: Range, expected: readonly string[]): void {
  expect(sortedCombos(actual)).toEqual(sortedCombos(expected.map(known)));
}

doctest("pokerkit.analysis.parse_range", (example) => {
  let rng: Range = [];
  example(1, () => {
    rng = range("AKs");
  });
  example(2, () => expect(rng).toHaveLength(4));
  example(3, () => expect(contains(rng, "AsKs")).toBe(true));
  example(4, () => expect(contains(rng, "AcKd")).toBe(false));
});

unitTest(
  "pokerkit.tests.test_analysis.HandHistoryTestCase.test_parse_range",
  () => {
    expectCombos(range("JJ"), ["JcJd", "JcJh", "JcJs", "JdJh", "JdJs", "JhJs"]);
    expectCombos(range("AK"), [
      "AcKd",
      "AcKh",
      "AcKs",
      "AdKc",
      "AdKh",
      "AdKs",
      "AhKc",
      "AhKd",
      "AhKs",
      "AsKc",
      "AsKd",
      "AsKh",
      "AcKc",
      "AdKd",
      "AhKh",
      "AsKs",
    ]);
    expectCombos(range("QJs"), ["QcJc", "QdJd", "QhJh", "QsJs"]);
    expectCombos(range("QTs"), ["QcTc", "QdTd", "QhTh", "QsTs"]);
    expectCombos(range("AKo"), [
      "AcKd",
      "AcKh",
      "AcKs",
      "AdKc",
      "AdKh",
      "AdKs",
      "AhKc",
      "AhKd",
      "AhKs",
      "AsKc",
      "AsKd",
      "AsKh",
    ]);
    expectCombos(range("JJ+"), [
      "JcJd",
      "JcJh",
      "JcJs",
      "JdJh",
      "JdJs",
      "JhJs",
      "QcQd",
      "QcQh",
      "QcQs",
      "QdQh",
      "QdQs",
      "QhQs",
      "KcKd",
      "KcKh",
      "KcKs",
      "KdKh",
      "KdKs",
      "KhKs",
      "AcAd",
      "AcAh",
      "AcAs",
      "AdAh",
      "AdAs",
      "AhAs",
    ]);
    expectCombos(range("QT+"), [
      "QcTd",
      "QcTh",
      "QcTs",
      "QdTc",
      "QdTh",
      "QdTs",
      "QhTc",
      "QhTd",
      "QhTs",
      "QsTc",
      "QsTd",
      "QsTh",
      "QcTc",
      "QdTd",
      "QhTh",
      "QsTs",
      "QcJd",
      "QcJh",
      "QcJs",
      "QdJc",
      "QdJh",
      "QdJs",
      "QhJc",
      "QhJd",
      "QhJs",
      "QsJc",
      "QsJd",
      "QsJh",
      "QcJc",
      "QdJd",
      "QhJh",
      "QsJs",
    ]);
    expectCombos(range("JTs+"), ["JcTc", "JdTd", "JhTh", "JsTs"]);
    expectCombos(range("JTo+"), [
      "JcTd",
      "JcTh",
      "JcTs",
      "JdTc",
      "JdTh",
      "JdTs",
      "JhTc",
      "JhTd",
      "JhTs",
      "JsTc",
      "JsTd",
      "JsTh",
    ]);
    expectCombos(range("JJ-TT"), [
      "JcJd",
      "JcJh",
      "JcJs",
      "JdJh",
      "JdJs",
      "JhJs",
      "TcTd",
      "TcTh",
      "TcTs",
      "TdTh",
      "TdTs",
      "ThTs",
    ]);
    expectCombos(range("JTs-KQs"), [
      "JcTc",
      "JdTd",
      "JhTh",
      "JsTs",
      "QcJc",
      "QdJd",
      "QhJh",
      "QsJs",
      "KcQc",
      "KdQd",
      "KhQh",
      "KsQs",
    ]);
    expectCombos(range("AsKh"), ["AsKh"]);
    expectCombos(range("2s3s"), ["2s3s"]);
    expectCombos(range("4s5h;2s3s"), ["4s5h", "2s3s"]);
    expectCombos(range("7s8s 27         AK", "ATs+"), [
      "7s8s",
      "2c7d",
      "2c7h",
      "2c7s",
      "2d7c",
      "2d7h",
      "2d7s",
      "2h7c",
      "2h7d",
      "2h7s",
      "2s7c",
      "2s7d",
      "2s7h",
      "2c7c",
      "2d7d",
      "2h7h",
      "2s7s",
      "AcKd",
      "AcKh",
      "AcKs",
      "AdKc",
      "AdKh",
      "AdKs",
      "AhKc",
      "AhKd",
      "AhKs",
      "AsKc",
      "AsKd",
      "AsKh",
      "AcKc",
      "AdKd",
      "AhKh",
      "AsKs",
      "AcQc",
      "AdQd",
      "AhQh",
      "AsQs",
      "AcJc",
      "AdJd",
      "AhJh",
      "AsJs",
      "AcTc",
      "AdTd",
      "AhTh",
      "AsTs",
    ]);
    expectCombos(range("99+", "2h7s"), [
      "9c9d",
      "9c9h",
      "9c9s",
      "9d9h",
      "9d9s",
      "9h9s",
      "TcTd",
      "TcTh",
      "TcTs",
      "TdTh",
      "TdTs",
      "ThTs",
      "JcJd",
      "JcJh",
      "JcJs",
      "JdJh",
      "JdJs",
      "JhJs",
      "QcQd",
      "QcQh",
      "QcQs",
      "QdQh",
      "QdQs",
      "QhQs",
      "KcKd",
      "KcKh",
      "KcKs",
      "KdKh",
      "KdKs",
      "KhKs",
      "AcAd",
      "AcAh",
      "AcAs",
      "AdAh",
      "AdAs",
      "AhAs",
      "2h7s",
    ]);
  }
);

doctest("pokerkit.analysis.calculate_equities", (example) => {
  example(1, () => {});
  example(2, () => {});
  example(3, () => {
    expect(
      equities({
        ranges: [range("33"), range("33")],
        board: known("Tc8d6h4s"),
        ...holdem,
        samples: 1000,
        random: seededRandom(1),
      })
    ).toEqual(ok([0.5, 0.5]));
  });
  example(4, () => {
    expect(
      equities({
        ranges: [range("2h2c"), range("3h3c"), range("AhKh")],
        board: known("3s3d4c"),
        ...holdem,
        samples: 1000,
        random: seededRandom(2),
      })
    ).toEqual(ok([0, 1, 0]));
  });
  example(5, () => {
    expect(
      equities({
        ranges: [range("2h2c"), range("3h3c"), range("AsKs")],
        board: known("QsJsTs"),
        ...holdem,
        samples: 1000,
        random: seededRandom(3),
      })
    ).toEqual(ok([0, 0, 1]));
  });
});

doctest("pokerkit.analysis.calculate_hand_strength", (example) => {
  example(1, () => {});
  example(2, () => {});
  example(3, () => {
    expect(
      handStrength({
        players: 3,
        range: range("3h3c"),
        board: known("3s3d2c2h"),
        ...holdem,
        samples: 1000,
        random: seededRandom(4),
      })
    ).toEqual(ok(1));
  });
  example(4, () => {
    expect(
      handStrength({
        players: 3,
        range: range("AsKs"),
        board: known("QsJsTs"),
        ...holdem,
        samples: 1000,
        random: seededRandom(5),
      })
    ).toEqual(ok(1));
  });
});

unitTest(
  "pokerkit.tests.test_analysis.HandHistoryTestCase.test_calculate_equities",
  () => {
    let seed = 0;
    const calculate = (ranges: readonly Range[], board: string) => {
      seed += 1;
      return okValue(
        equities({
          ranges,
          board: known(board),
          ...holdem,
          samples: 10_000,
          random: seededRandom(seed),
        })
      );
    };

    let values = calculate([range("AsKs"), range("2h2c")], "");
    expect(values).toHaveLength(2);
    expect(sum(values)).toBeCloseTo(1, 7);

    values = calculate([range("JsTs"), range("AhAd")], "9s8s2c");
    expect(values).toHaveLength(2);
    expect(sum(values)).toBeCloseTo(1, 7);

    values = calculate([range("AKs"), range("22")], "");
    expect(values).toHaveLength(2);
    expect(sum(values)).toBeCloseTo(1, 7);

    values = calculate([range("AA"), range("22")], "");
    expect(values).toHaveLength(2);
    expect(sum(values)).toBeCloseTo(1, 7);

    values = calculate([range("2h2c"), range("3h3c"), range("AsKs")], "QsJsTs");
    expect(values).toHaveLength(3);
    expect(sum(values)).toBeCloseTo(1, 7);
    expect(values[0]).toBeCloseTo(0, 7);
    expect(values[1]).toBeCloseTo(0, 7);
    expect(values[2]).toBeCloseTo(1, 7);

    values = calculate([range("2h2c"), range("3h3c"), range("AhKh")], "3s3d4c");
    expect(values).toHaveLength(3);
    expect(sum(values)).toBeCloseTo(1, 7);
    expect(values[0]).toBeCloseTo(0, 7);
    expect(values[1]).toBeCloseTo(1, 7);
    expect(values[2]).toBeCloseTo(0, 7);

    values = calculate([range("3d3h"), range("3c3s")], "Tc8d6h4s");
    expect(values).toHaveLength(2);
    expect(sum(values)).toBeCloseTo(1, 7);
    expect(values[0]).toBeCloseTo(0.5, 7);
    expect(values[1]).toBeCloseTo(0.5, 7);
  }
);

unitTest("pokerkit.tests.test_analysis.HandHistoryTestCase.test_scoops", () => {
  const board = known("KhQdJc9s8h");
  const hole0 = known("AcAd2s3s");
  const hole1 = known("KcKd4s5s");

  for (const hole of [hole0, hole1]) {
    expect(evaluate("omahaEightOrBetterLow", hole, board)).toBeNull();
  }

  expect(
    compareHands(
      fromGame("omahaHigh", hole0, board),
      fromGame("omahaHigh", hole1, board)
    )
  ).toBe(-1);

  const actual = equities({
    ranges: [[hole0], [hole1]],
    board,
    holeCount: 4,
    boardCount: 5,
    deck: decks.standard,
    handTypes: ["omahaHigh", "omahaEightOrBetterLow"],
    samples: 1,
    random: seededRandom(6),
  });

  expect(actual).toEqual(ok([0, 1]));
});
