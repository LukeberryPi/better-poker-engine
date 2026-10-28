import { expect } from "bun:test";

import { doctest } from "../../../../parity/harness.ts";
import { draw, holdem } from "../../src/rules.ts";
import {
  allBut,
  called,
  checkOrCall,
  drive,
  inProgress,
  minimumRaise,
  repeat,
  start,
  steps,
  type Driver,
} from "../driver.ts";

const automate = allBut("runoutCountSelection");

function threeHanded(): Driver {
  const game = holdem.noLimit({
    blinds: [1, 2],
    minBet: 2,
    anteTrimming: true,
  });
  return drive(start(game, [100, 100, 200], automate));
}

const fold = { type: "fold" } as const;

doctest("pokerkit.state.State.can_fold", (example) => {
  let table: Driver;
  example(1, () => {});
  example(2, () => {
    table = threeHanded();
  });
  example(3, () => expect(table.can(fold)).toBe(true));
  steps(example, () => table, [
    [4, fold, { type: "folded", player: "p3", needless: false }],
  ]);
  example(5, () => expect(table.can(fold)).toBe(true));
  steps(example, () => table, [[6, checkOrCall, called("p1", 1)]]);
  example(7, () => expect(table.can(fold)).toBe(false));
  steps(example, () => table, [
    [
      8,
      { type: "betOrRaiseTo", amount: 4 },
      { type: "betOrRaised", player: "p2", kind: "raise", to: 4, allIn: false },
    ],
    [9, fold, { type: "folded", player: "p1", needless: false }],
  ]);
  example(10, () => expect(inProgress(table.hand)).toBe(false));
  example(11, () => expect(table.can(fold)).toBe(false));
});

doctest("pokerkit.state.State.can_check_or_call", (example) => {
  let table: Driver;
  example(1, () => {});
  example(2, () => {
    table = threeHanded();
  });
  example(3, () => expect(table.can(checkOrCall)).toBe(true));
  steps(example, () => table, [
    [4, fold, { type: "folded", player: "p3", needless: false }],
  ]);
  example(5, () => expect(table.can(checkOrCall)).toBe(true));
  steps(example, () => table, [
    [6, fold, { type: "folded", player: "p1", needless: false }],
  ]);
  example(7, () => expect(inProgress(table.hand)).toBe(false));
  example(8, () => expect(table.can(checkOrCall)).toBe(false));
});

doctest("pokerkit.state.State.can_complete_bet_or_raise_to", (example) => {
  let table: Driver;
  const canRaiseTo = (amount: number) =>
    table.can({ type: "betOrRaiseTo", amount });
  example(1, () => {});
  example(2, () => {
    table = threeHanded();
  });
  example(3, () => expect(table.can(minimumRaise(table))).toBe(true));
  example(4, () => expect(canRaiseTo(4)).toBe(true));
  example(5, () => expect(canRaiseTo(200)).toBe(true));
  example(6, () => expect(canRaiseTo(3)).toBe(false));
  example(7, () => expect(canRaiseTo(201)).toBe(false));
  steps(example, () => table, [
    [8, checkOrCall, called("p3", 2)],
    [
      9,
      { type: "betOrRaiseTo", amount: 100 },
      {
        type: "betOrRaised",
        player: "p1",
        kind: "raise",
        to: 100,
        allIn: true,
      },
    ],
    [10, fold, { type: "folded", player: "p2", needless: false }],
  ]);
  example(11, () => expect(canRaiseTo(200)).toBe(false));
  steps(example, () => table, [[12, checkOrCall, called("p3", 98)]]);
  example(13, () => expect(inProgress(table.hand)).toBe(false));
  example(14, () => expect(table.can(minimumRaise(table))).toBe(false));
  example(15, () => {
    const game = draw.deuceToSevenTriple({
      blinds: [1, 2],
      smallBet: 2,
      bigBet: 4,
      anteTrimming: true,
    });
    table = drive(start(game, repeat(200, 6), automate));
  });
  const raises = [
    [16, "p3", 4],
    [18, "p4", 6],
    [20, "p5", 8],
    [22, "p6", 10],
  ] as const;
  for (const [index, player, to] of raises) {
    example(index, () => expect(table.can(minimumRaise(table))).toBe(true));
    example(index + 1, () => {
      expect(table.act(minimumRaise(table))).toEqual({
        type: "betOrRaised",
        player,
        kind: "raise",
        to,
        allIn: false,
      });
    });
  }
  example(24, () => expect(table.can(minimumRaise(table))).toBe(false));
  example(25, () => {
    expect(table.reject(minimumRaise(table))).toEqual({
      code: "betting_capped",
      limit: 4,
    });
  });
});
