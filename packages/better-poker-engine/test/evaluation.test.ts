import { describe, expect, test } from "bun:test";

import { decks, shuffle } from "../src/cards.ts";
import { evaluate, evaluateStrength } from "../src/evaluation.ts";
import { insecureSeededRandom } from "../src/random.ts";
import { cards, known } from "./support.ts";

describe("evaluate", () => {
  test("keeps the first of equally strong card sets, as pokerkit does", () => {
    const value = evaluate("standardHigh", cards("AsAc"), cards("AhAdKcKh2s"));
    expect(value?.cards).toEqual(known("AsAcAhAdKc"));
  });

  test("is null while any card is not fully known", () => {
    expect(evaluate("standardHigh", cards("AsKs"), cards("QsJsTs9s??"))).toBe(
      null
    );
    expect(evaluate("standardHigh", cards("AsK?"), cards("QsJsTs9s"))).toBe(
      null
    );
  });

  test("is null when the cards are too few for a hand", () => {
    expect(evaluate("standardHigh", cards("AsKs"), cards("QsJs"))).toBe(null);
  });
});

const strengths = (hole: string, board: string) => [
  evaluateStrength("standardHigh", cards(hole), cards(board)),
  evaluate("standardHigh", cards(hole), cards(board))?.strength ?? null,
];

describe("evaluateStrength", () => {
  test("agrees with evaluate on 200,000 random seven-card hands", () => {
    const random = insecureSeededRandom(11);
    const differing: Array<string> = [];
    for (let deal = 0; deal < 200_000; deal += 1) {
      const dealt = shuffle(decks.standard, random);
      const hole = dealt.slice(0, 2);
      const board = dealt.slice(2, 7);
      if (
        evaluateStrength("standardHigh", hole, board) !==
        evaluate("standardHigh", hole, board)?.strength
      ) {
        differing.push([...hole, ...board].join(""));
      }
    }
    expect(differing).toEqual([]);
  });

  test("agrees on flushes of five, six and seven cards and on straight flushes", () => {
    for (const [hole, board] of [
      ["AsKs", "QsJsTs9s8s"],
      ["5s4s", "3s2sAsKdKh"],
      ["2h7h", "9hJhKh3h4c"],
      ["AsAh", "AdKsKh2s3s"],
      ["6d7d", "8d9dTdTcTh"],
    ] as const) {
      const [fast, slow] = strengths(hole, board);
      expect(fast).toBe(slow ?? -1);
    }
  });

  test("gives null for an unknown card and defers other hands to evaluate", () => {
    expect(strengths("As??", "KsQsJsTs9s")).toEqual([null, null]);
    expect(
      evaluateStrength("omahaHigh", cards("AsKsQhJh"), cards("Ts9s8s"))
    ).toBe(
      evaluate("omahaHigh", cards("AsKsQhJh"), cards("Ts9s8s"))?.strength ??
        null
    );
  });
});
