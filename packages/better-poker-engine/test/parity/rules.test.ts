import { expect } from "bun:test";

import { unitTest } from "../../../../parity/harness.ts";
import { automation, type Hand, type RaiseRange } from "../../src/hand.ts";
import { holdem, omaha } from "../../src/rules.ts";
import {
  auditor,
  drive,
  minimumRaise,
  moves,
  play,
  start,
  type Driver,
} from "../driver.ts";

const { call, fold, raiseTo } = moves;

unitTest(
  "pokerkit.tests.test_rules.WSOPTournamentRulesTestCase.test_2024_96",
  () => {
    const noLimit = holdem.noLimit({
      blinds: [100, 200],
      minBet: 200,
      anteTrimming: true,
    });
    const shortAllIn = drive(
      start(noLimit, [650, 20000, 20000], automation.all)
    );
    play(shortAllIn, [raiseTo(600), raiseTo(650), call]);
    expect(shortAllIn.can(minimumRaise(shortAllIn))).toBe(false);

    const potLimit = omaha.potLimit({
      blinds: [5, 10],
      minBet: 10,
      anteTrimming: true,
    });
    const reopened = drive(
      start(potLimit, [400, 400, 1000, 400, 100], automation.all)
    );
    play(reopened, [raiseTo(30), raiseTo(90), raiseTo(100), fold, fold]);
    expect(reopened.can({ type: "betOrRaiseTo", amount: 200 })).toBe(true);
  }
);

/** The raise range a player gets, once they may raise at all. */
function raiseRange(table: Driver) {
  expect(table.can(minimumRaise(table))).toBe(true);
  const decision = auditor(table.hand).decision;
  if (decision.kind !== "betting") throw new Error(decision.kind);
  return decision.betOrRaiseTo;
}

unitTest(
  "pokerkit.tests.test_rules.WSOPTournamentRulesTestCase.test_2024_96_a",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "everyone", amount: 1 },
      blinds: [],
      minBet: 1,
      anteTrimming: true,
    });
    const table = drive(
      start(game, [20001, 20001, 20001, 1301, 1701], automation.all)
    );
    play(table, [
      raiseTo(500),
      raiseTo(1000),
      call,
      raiseTo(1300),
      raiseTo(1700),
    ]);
    const reopenedFor: Hand = table.hand;
    const range = { kind: "raise", min: 2200, max: 20000 } satisfies RaiseRange;

    const afterCall = drive(reopenedFor);
    call(afterCall);
    expect(raiseRange(afterCall)).toEqual(range);
    call(afterCall);
    expect(raiseRange(afterCall)).toEqual(range);

    const afterFold = drive(reopenedFor);
    fold(afterFold);
    expect(raiseRange(afterFold)).toEqual(range);
    call(afterFold);
    expect(raiseRange(afterFold)).toEqual(range);
  }
);
