import { describe, expect, test } from "bun:test";

import { equities, handStrength, type Range } from "../../src/analysis.ts";
import { decks } from "../../src/cards.ts";
import { seededRandom } from "../../src/random.ts";
import { err, ok } from "../../src/result.ts";
import { known, okValue, range, scripted } from "../support.ts";

const holdem = {
  board: [],
  holeCount: 2,
  boardCount: 5,
  deck: decks.standard,
  handTypes: ["standardHigh"],
  samples: 1,
  random: seededRandom(7),
} as const;

/** One Kuhn card each from J, Q and K of spades; the higher card wins. */
const kuhn = {
  board: [],
  holeCount: 1,
  boardCount: 0,
  deck: decks.kuhn,
  handTypes: ["kuhn"],
  samples: 1,
} as const;

const anyCards: Range = [[]];

describe("equities", () => {
  test("deals players in turn, then the board, with unbiased draws", () => {
    const deal = { ...kuhn, ranges: [anyCards, anyCards] };
    // The selection, then 2 ** 32 - 1, which an unbiased draw of 3 rejects.
    const random = scripted([0, 2 ** 32 - 1, 2, 0]);
    expect(equities({ ...deal, random })).toEqual(ok([1, 0]));
  });

  test("averages the deals' shares", () => {
    const deal = { ...kuhn, ranges: [[known("Qs")], anyCards], samples: 2 };
    const random = scripted([0, 0, 0, 1]);
    expect(equities({ ...deal, random })).toEqual(ok([0.5, 0.5]));
  });

  test("splits each hand type's part among its best hands", () => {
    const quartered = equities({
      ...holdem,
      ranges: [[known("As2sKdKh")], [known("Ad2d7c8c")]],
      board: known("3c4d5hKcKs"),
      holeCount: 4,
      handTypes: ["omahaHigh", "omahaEightOrBetterLow"],
    });
    expect(quartered).toEqual(ok([0.75, 0.25]));
  });

  test("chooses uniformly among selections that repeat no card", () => {
    const deal = {
      ...holdem,
      ranges: [range("AsAh 2c2d"), range("AsKs AdKd")],
      board: known("Kh9d5c4sJh"),
      samples: 3,
    };
    const random = scripted([0, 1, 2]);
    expect(equities({ ...deal, random })).toEqual(ok([1 / 3, 2 / 3]));
  });

  test("agrees with the known preflop equity of AA against KK", () => {
    const [aces = 0, kings = 0] = okValue(
      equities({
        ...holdem,
        ranges: [range("AA"), range("KK")],
        samples: 20_000,
      })
    );
    expect(Math.abs(aces - 0.82)).toBeLessThan(0.012);
    expect(aces + kings).toBeCloseTo(1, 12);
  });

  test("gives the same result for the same seed and leaves inputs alone", () => {
    const frozen = (text: string): Range =>
      Object.freeze(range(text).map((combo) => Object.freeze([...combo])));
    const input = Object.freeze({
      ...holdem,
      ranges: Object.freeze([frozen("QQ+"), frozen("AKs")]),
      board: Object.freeze(known("2c7d")),
      samples: 200,
    });
    const first = equities({ ...input, random: seededRandom(11) });
    expect(equities({ ...input, random: seededRandom(11) })).toEqual(first);
    expect(equities({ ...input, random: seededRandom(12) })).not.toEqual(first);
  });

  test("returns nothing for no players", () => {
    expect(equities({ ...holdem, ranges: [] })).toEqual(ok([]));
  });

  test("rejects counts that are not whole numbers in range", () => {
    const ranges = [range("AA"), range("KK")];
    expect(equities({ ...holdem, ranges, holeCount: -1 })).toEqual(
      err({ code: "invalid_count", field: "holeCount", value: -1 })
    );
    expect(equities({ ...holdem, ranges, boardCount: 2.5 })).toEqual(
      err({ code: "invalid_count", field: "boardCount", value: 2.5 })
    );
    expect(equities({ ...holdem, ranges, samples: 0 })).toEqual(
      err({ code: "invalid_count", field: "samples", value: 0 })
    );
  });

  test("rejects more cards than a player or the board ends with", () => {
    expect(
      equities({ ...holdem, ranges: [range("AA"), range("AsKsQs, KK")] })
    ).toEqual(err({ code: "too_many_hole_cards", player: 1, cards: 3 }));
    expect(
      equities({
        ...holdem,
        ranges: [range("AA")],
        board: known("2c3c4c5c6c7c"),
      })
    ).toEqual(err({ code: "too_many_board_cards", cards: 6 }));
  });

  test("rejects ranges that cannot all be dealt", () => {
    const deals = [
      { ranges: [range("AA"), [], range("KK")], board: [] },
      { ranges: [range("AA"), range("AA"), range("AA")], board: [] },
      { ranges: [range("AsKs")], board: known("Ks") },
      { ranges: [range("AA")], board: known("2c2c") },
    ];
    for (const deal of deals) {
      expect(equities({ ...holdem, ...deal })).toEqual(
        err({ code: "no_deal" })
      );
    }
  });

  test("rejects a deck too small for the deal", () => {
    expect(
      equities({
        ...kuhn,
        ranges: [anyCards, anyCards, anyCards],
        boardCount: 1,
        random: seededRandom(8),
      })
    ).toEqual(err({ code: "not_enough_cards", needed: 4, available: 3 }));
  });

  test("rejects a deal in which nobody forms a hand", () => {
    const ranges = [range("AA"), range("KK")];
    expect(equities({ ...holdem, ranges, handTypes: [] })).toEqual(
      err({ code: "no_hand" })
    );
    expect(equities({ ...holdem, ranges, boardCount: 0 })).toEqual(
      err({ code: "no_hand" })
    );
  });
});

describe("handStrength", () => {
  test("deals the random opponents before the player", () => {
    const strength = (values: readonly number[]) =>
      handStrength({
        ...kuhn,
        players: 2,
        range: anyCards,
        random: scripted(values),
      });
    expect(strength([0, 2, 0])).toEqual(ok(0));
    expect(strength([0, 0, 1])).toEqual(ok(1));
  });

  test("is certain alone and rejects fewer than one player", () => {
    const input = { ...holdem, range: range("72o") };
    expect(handStrength({ ...input, players: 1 })).toEqual(ok(1));
    expect(handStrength({ ...input, players: 0 })).toEqual(
      err({ code: "invalid_count", field: "players", value: 0 })
    );
  });
});
