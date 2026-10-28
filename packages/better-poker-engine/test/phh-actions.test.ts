import { describe, expect, test } from "bun:test";

import { formatPhhAction, parsePhhAction } from "../src/phh-actions.ts";

function reformat(text: string): string | null {
  const action = parsePhhAction(text);
  return action === null ? null : formatPhhAction(action);
}

describe("parsePhhAction", () => {
  test("reads dealing to the board and to a player", () => {
    expect(parsePhhAction("d db Jc3d5c")).toEqual({
      type: "dealBoard",
      cards: ["Jc", "3d", "5c"],
      commentary: null,
    });
    expect(parsePhhAction("d dh p2 ????")).toEqual({
      type: "dealHole",
      player: 2,
      cards: ["??", "??"],
      commentary: null,
    });
  });

  test("reads folds, checks and calls, bring-ins, bets and raises", () => {
    expect(parsePhhAction("p3 f")).toEqual({
      type: "fold",
      player: 3,
      commentary: null,
    });
    expect(parsePhhAction("p1 cc")).toEqual({
      type: "checkOrCall",
      player: 1,
      commentary: null,
    });
    expect(parsePhhAction("p4 pb")).toEqual({
      type: "postBringIn",
      player: 4,
      commentary: null,
    });
    expect(parsePhhAction("p12 cbr 0.25")).toEqual({
      type: "betOrRaiseTo",
      player: 12,
      amount: "0.25",
      commentary: null,
    });
  });

  test("reads standing pat as a draw that discards nothing", () => {
    expect(parsePhhAction("p1 sd")).toEqual({
      type: "draw",
      player: 1,
      discard: [],
      commentary: null,
    });
    expect(parsePhhAction("p4 sd AsQs")).toEqual({
      type: "draw",
      player: 4,
      discard: ["As", "Qs"],
      commentary: null,
    });
  });

  test("reads showing named cards, showing unnamed cards and mucking", () => {
    expect(parsePhhAction("p2 sm 8s??")).toEqual({
      type: "show",
      player: 2,
      cards: ["8s", "??"],
      commentary: null,
    });
    expect(parsePhhAction("p2 sm -")).toEqual({
      type: "show",
      player: 2,
      cards: null,
      commentary: null,
    });
    expect(parsePhhAction("p2 sm")).toEqual({
      type: "muck",
      player: 2,
      commentary: null,
    });
  });

  test("reads empty, blank and commentary-only actions as no-ops", () => {
    expect(parsePhhAction("")).toEqual({ type: "noOp", commentary: null });
    expect(parsePhhAction(" \t ")).toEqual({ type: "noOp", commentary: null });
    expect(parsePhhAction("# Burn card 6s is exposed")).toEqual({
      type: "noOp",
      commentary: "Burn card 6s is exposed",
    });
  });

  test("keeps the commentary after the first standalone hash verbatim", () => {
    expect(parsePhhAction("p3 cbr 7000 # Dwan")).toEqual({
      type: "betOrRaiseTo",
      player: 3,
      amount: "7000",
      commentary: "Dwan",
    });
    expect(parsePhhAction("p1 cc #")).toEqual({
      type: "checkOrCall",
      player: 1,
      commentary: "",
    });
    expect(parsePhhAction("p1 f #  two # hashes ")).toEqual({
      type: "fold",
      player: 1,
      commentary: " two # hashes ",
    });
  });

  test("separates words by any run of whitespace", () => {
    expect(parsePhhAction("  d\tdh  p1\nAc2d  ")).toEqual({
      type: "dealHole",
      player: 1,
      cards: ["Ac", "2d"],
      commentary: null,
    });
  });

  test("reads an amount in canonical form", () => {
    expect(parsePhhAction("p1 cbr 007.50")).toEqual({
      type: "betOrRaiseTo",
      player: 1,
      amount: "7.5",
      commentary: null,
    });
  });

  test("rejects actions outside the PHH grammar", () => {
    for (const text of [
      "p1",
      "p0 f",
      "p01 f",
      "P1 f",
      "p1.5 f",
      "p1 xx",
      "p1 f now",
      "p1 cc Ac",
      "p1 cbr",
      "p1 cbr 0",
      "p1 cbr -5",
      "p1 cbr 1e3",
      "p1 cbr 1,000",
      "p1 cbr .5",
      "p1 cbr inf",
      "d db",
      "d db Ac Kd",
      "d db Xx",
      "d dh p1",
      "d dh AcKd",
      "d dh p1 AcK",
      "d dh p1 AcKd Qh",
      "d xx Ac",
      "d f",
      "p1 sd Xx",
      "p1 sm Xx",
      "p1 cc #note",
      "p1 cc# note",
      "#note",
    ]) {
      expect({ text, action: parsePhhAction(text) }).toEqual({
        text,
        action: null,
      });
    }
  });
});

describe("formatPhhAction", () => {
  test("writes back what pokerkit writes", () => {
    for (const text of [
      "d db Jc3d5c",
      "d dh p2 ????",
      "p3 f",
      "p1 cc",
      "p4 pb",
      "p1 cbr 7000",
      "p1 cbr 0.25",
      "p1 sd",
      "p4 sd AsQs",
      "p2 sm 8sAh",
      "p2 sm -",
      "p2 sm",
      "",
      "p3 cbr 7000 # Dwan",
      "p1 cc #",
      "# Burn card 6s is exposed",
      "#",
    ]) {
      expect(reformat(text)).toBe(text);
    }
  });

  test("normalizes spacing, card text and amounts", () => {
    expect(reformat("  p1   cbr 007.50  ")).toBe("p1 cbr 7.5");
    expect(reformat("d dh p1 10h,Ac")).toBe("d dh p1 ThAc");
    expect(reformat("   # note")).toBe("# note");
    expect(reformat("p1 cc #  spaced ")).toBe("p1 cc #  spaced ");
  });

  test("writes a hand-built amount in canonical form", () => {
    expect(
      formatPhhAction({
        type: "betOrRaiseTo",
        player: 1,
        amount: "1e3",
        commentary: null,
      })
    ).toBe("p1 cbr 1000");
  });
});
