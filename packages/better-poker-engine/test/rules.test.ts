import { describe, expect, test } from "bun:test";

import { automation } from "../src/hand.ts";
import {
  holdem,
  kuhn,
  leduc,
  numeral211,
  rhodeIsland,
  royal,
} from "../src/rules.ts";
import {
  auditor,
  drive,
  minimumRaise,
  moves,
  play,
  stacks,
  start,
} from "./driver.ts";
import { cards } from "./support.ts";

const { call, raiseTo } = moves;

describe("kuhn.fixedLimit", () => {
  test("antes 1 and allows one bet of 1, the higher card winning", () => {
    const table = drive(
      start(kuhn.fixedLimit(), [10, 10], automation.all, cards("QsKs"))
    );
    play(table, [raiseTo(1)]);
    expect(table.can(minimumRaise(table))).toBe(false);
    play(table, [call]);
    expect(stacks(table.hand)).toEqual([8, 12]);
  });

  test("takes a bet other than pokerkit's", () => {
    const table = drive(
      start(
        kuhn.fixedLimit({ bet: 2 }),
        [10, 10],
        automation.all,
        cards("QsKs")
      )
    );
    play(table, [raiseTo(2)]);
    expect(table.can(minimumRaise(table))).toBe(false);
    play(table, [call]);
    expect(stacks(table.hand)).toEqual([7, 13]);
  });
});

describe("leduc.fixedLimit", () => {
  test("antes 1 and bets 2, then 4 after the board card, two bets a street", () => {
    const table = drive(
      start(leduc.fixedLimit(), [13, 13], automation.all, cards("KhJsQsJh"))
    );
    play(table, [raiseTo(2), raiseTo(4)]);
    expect(table.can(minimumRaise(table))).toBe(false);
    play(table, [call, call, raiseTo(4), call]);
    expect(stacks(table.hand)).toEqual([4, 22]);
  });
});

describe("rhodeIsland.fixedLimit", () => {
  test("takes antes and bets other than pokerkit's", () => {
    const game = rhodeIsland.fixedLimit({
      antes: { kind: "everyone", amount: 1 },
      smallBet: 2,
      bigBet: 4,
    });
    const deck = cards("As2c3dAd4dKc");
    const table = drive(start(game, [20, 20], automation.all, deck));
    play(table, [raiseTo(2), call, raiseTo(4), call, call, call]);
    expect(stacks(table.hand)).toEqual([27, 13]);
  });
});

describe("numeral211.fixedLimit", () => {
  test("allows four bets a street and ranks nine, ten, ace as a straight", () => {
    const deck = cards("9cTc2sTh3sAd");
    const table = drive(
      start(numeral211.fixedLimit(), [205, 205], automation.all, deck)
    );
    play(table, [raiseTo(10), raiseTo(20), raiseTo(30), raiseTo(40)]);
    expect(table.can(minimumRaise(table))).toBe(false);
    play(table, [call, raiseTo(20), call, call, call]);
    expect(stacks(table.hand)).toEqual([270, 140]);
  });

  test("deals from the forty cards without jacks, queens and kings", () => {
    const table = drive(
      start(numeral211.fixedLimit(), [205, 205], automation.all)
    );
    expect(auditor(table.hand).dealer?.deck).toHaveLength(38);
  });
});

describe("royal", () => {
  test("deals no-limit Texas hold'em from the royal deck", () => {
    const stakes = { blinds: [1, 2], minBet: 2 };
    const texas = holdem.noLimit(stakes);
    expect(royal.noLimit(stakes)).toEqual({
      ...texas,
      variant: "custom",
      rules: { ...texas.rules, deck: "royal" },
    });
  });

  test("deals Rhode Island hold'em from the royal deck", () => {
    const standard = rhodeIsland.fixedLimit();
    expect(royal.rhodeIsland()).toEqual({
      ...standard,
      rules: { ...standard.rules, deck: "royal" },
    });
  });
});
