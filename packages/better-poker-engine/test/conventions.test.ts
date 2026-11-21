import { describe, expect, test } from "bun:test";

import {
  actAs,
  automation,
  startHand,
  summarizeHand,
  type Action,
  type Automation,
} from "../src/hand.ts";
import {
  conventions,
  holdem,
  type Conventions,
  type Game,
  type RakeCap,
} from "../src/rules.ts";
import { auditor, drive, start, type Driver } from "./driver.ts";
import { cards } from "./support.ts";

const call: Action = { type: "checkOrCall" };
const fold: Action = { type: "fold" };

function raiseTo(amount: number): Action {
  return { type: "betOrRaiseTo", amount };
}

function noLimit(rules: Conventions): Game {
  return holdem.noLimit({ blinds: [50, 100], minBet: 100, conventions: rules });
}

function played(
  game: Game,
  stacks: readonly number[],
  actions: readonly Action[],
  automate: Automation = automation.all
): Driver {
  const table = drive(start(game, stacks, automate));
  for (const action of actions) table.act(action);
  return table;
}

const unclaimedCash = {
  ...conventions.cashGame,
  strandedPots: "unclaimed",
} satisfies Conventions;

describe("bigBlindIsFullBet", () => {
  const limpThenShortAllIn = [call, raiseTo(150), fold, call];

  test("off, as in pokerkit: a short all-in over the blind reopens a limper", () => {
    const table = played(
      noLimit(conventions.tournament),
      [1000, 1000, 1000, 150],
      limpThenShortAllIn
    );
    expect(auditor(table.hand).decision).toMatchObject({
      player: "p3",
      betOrRaiseTo: { kind: "raise", min: 250 },
    });
  });

  test("on, keeps every blind's option to raise: small, big, and posted live", () => {
    const blinds = played(
      noLimit(conventions.tda2024),
      [1000, 1000, 1000],
      [call]
    );
    expect(auditor(blinds.hand).decision).toMatchObject({
      player: "p1",
      betOrRaiseTo: { kind: "raise", min: 200 },
    });
    blinds.act(call);
    expect(auditor(blinds.hand).decision).toMatchObject({
      player: "p2",
      checkOrCall: { kind: "check" },
      betOrRaiseTo: { kind: "raise", min: 200 },
    });
    const posted = played(
      holdem.noLimit({
        blinds: [50, 100, 0, -100],
        minBet: 100,
        conventions: conventions.tda2024,
      }),
      [1000, 1000, 1000, 1000, 1000],
      [call]
    );
    expect(auditor(posted.hand).decision).toMatchObject({
      player: "p4",
      checkOrCall: { kind: "check" },
      betOrRaiseTo: { kind: "raise", min: 200 },
    });
  });

  test("on, as TDA Rule 47: the limper may only call or fold", () => {
    const table = played(
      noLimit(conventions.tda2024),
      [1000, 1000, 1000, 150],
      limpThenShortAllIn
    );
    expect(auditor(table.hand).decision).toMatchObject({
      player: "p3",
      checkOrCall: { kind: "call", amount: 50 },
      betOrRaiseTo: null,
    });
    expect(table.reject(raiseTo(250))).toEqual({
      code: "action_not_reopened",
    });
  });
});

describe("bigBlindIsFullBet, player by player", () => {
  const limpedThrough = [call, call, call, call];

  test("on, judges each player by what they faced when they last acted", () => {
    const table = played(
      noLimit(conventions.tda2024),
      [10_000, 250, 10_000, 300],
      [...limpedThrough, raiseTo(100), raiseTo(150), call, raiseTo(200)]
    );
    expect(auditor(table.hand).decision).toMatchObject({
      player: "p1",
      betOrRaiseTo: { kind: "raise", min: 300 },
    });
    table.act(call);
    expect(auditor(table.hand).decision).toMatchObject({
      player: "p3",
      checkOrCall: { kind: "call", amount: 50 },
      betOrRaiseTo: null,
    });
  });

  test("on, reopens for a player whom three short all-ins have raised a full raise", () => {
    const table = played(
      noLimit(conventions.tda2024),
      [10_000, 10_000, 10_000, 150, 200, 240],
      [call, raiseTo(150), raiseTo(200), raiseTo(240), call, fold]
    );
    expect(auditor(table.hand).decision).toMatchObject({
      player: "p3",
      checkOrCall: { kind: "call", amount: 140 },
      betOrRaiseTo: { kind: "raise", min: 340 },
    });
  });

  const shortBetAfterCheck = (rules: Conventions) =>
    played(
      noLimit(rules),
      [1000, 150, 1000],
      [call, call, call, call, raiseTo(50), call]
    );

  test("off, as in pokerkit: a short all-in bet lets the player who checked raise", () => {
    expect(
      auditor(shortBetAfterCheck(conventions.tournament).hand).decision
    ).toMatchObject({ player: "p1", betOrRaiseTo: { kind: "raise" } });
  });

  test("on: the player who checked may only call or fold", () => {
    expect(
      auditor(shortBetAfterCheck(conventions.tda2024).hand).decision
    ).toMatchObject({ player: "p1", betOrRaiseTo: null });
  });
});

describe("nominalBigBlind", () => {
  test("off, as in pokerkit: a big blind all-in for 60 prices the call at 60", () => {
    const table = played(noLimit(conventions.tournament), [1000, 60, 1000], []);
    expect(auditor(table.hand).decision).toMatchObject({
      player: "p3",
      checkOrCall: { kind: "call", amount: 60 },
      betOrRaiseTo: { min: 160 },
    });
  });

  test("on: the call is the full 100, the minimum raise 200, and the excess a side pot", () => {
    const table = played(noLimit(conventions.tda2024), [1000, 60, 1000], []);
    expect(auditor(table.hand).decision).toMatchObject({
      player: "p3",
      checkOrCall: { kind: "call", amount: 100 },
      betOrRaiseTo: { min: 200 },
    });
    table.act(call);
    table.act(call);
    expect(auditor(table.hand).pots).toEqual([
      { amount: 180, raked: 0, eligible: ["p1", "p2", "p3"] },
      { amount: 80, raked: 0, eligible: ["p1", "p3"] },
    ]);
  });
});

describe("antePrecedence", () => {
  const bigBlindAnte = (rules: Conventions) =>
    auditor(
      start(
        holdem.noLimit({
          blinds: [50, 100],
          minBet: 100,
          antes: { kind: "bigBlind", amount: 100 },
          conventions: rules,
        }),
        [1000, 150, 1000],
        automation.all
      )
    );

  test("ante first, as in pokerkit: a big blind of 150 posts ante 100, blind 50", () => {
    const view = bigBlindAnte(conventions.tournament);
    expect(view.players[1]?.bet).toBe(50);
    expect(view.pots.map((pot) => pot.amount)).toEqual([100]);
  });

  test("blind first, as the 2024 TDA rules: blind 100, ante 50", () => {
    const view = bigBlindAnte(conventions.tda2024);
    expect(view.players[1]?.bet).toBe(100);
    expect(view.pots.map((pot) => pot.amount)).toEqual([50]);
  });
});

describe("oddChips", () => {
  const royalBoard = cards("2c4c6c8c3d5d7d9h 2h AsKsQs 3h Js 4h Ts");
  const splitThreeWays = (rules: Conventions) => {
    const table = drive(
      start(
        holdem.noLimit({ blinds: [1, 2], minBet: 2, conventions: rules }),
        [100, 100, 100, 100],
        automation.all,
        royalBoard
      )
    );
    for (const action of [raiseTo(11), call, call, fold]) table.act(action);
    for (let check = 0; check < 9; check += 1) table.act(call);
    return summarizeHand(table.hand)?.pots.flatMap((pot) =>
      pot.winners.map((winner) => [winner.player, winner.amount])
    );
  };

  test("firstShare, as in pokerkit: 35 split three ways pays 13, 11, 11", () => {
    expect(splitThreeWays(conventions.tournament)).toEqual([
      ["p1", 13],
      ["p3", 11],
      ["p4", 11],
    ]);
  });

  test("oneEach: 12, 12, 11 from the first seat after the button", () => {
    expect(splitThreeWays(conventions.tda2024)).toEqual([
      ["p1", 12],
      ["p3", 12],
      ["p4", 11],
    ]);
  });
});

describe("rake cap", () => {
  const raked = (cap: RakeCap) => {
    const game = holdem.noLimit({
      blinds: [50, 100],
      minBet: 100,
      rake: { kind: "percentage", basisPoints: 500, cap, noFlopNoDrop: false },
    });
    const table = played(game, [2000, 500, 2000], [raiseTo(2000), call, call]);
    return summarizeHand(table.hand)?.rake;
  };

  test("per pot, as in pokerkit: a main and a side pot each pay up to the cap", () => {
    expect(raked({ amount: 50, per: "pot" })).toBe(100);
  });

  test("per hand: the hand pays the cap once, main pot first", () => {
    expect(raked({ amount: 50, per: "hand" })).toBe(50);
  });
});

describe("strandedPots", () => {
  const sidePotThenNeedlessFold = [
    call,
    raiseTo(1954),
    call,
    call,
    call,
    call,
    fold,
  ];

  test("refused: the last player with chips can't fold the side pot away", () => {
    const table = played(
      noLimit(conventions.cashGame),
      [3457, 229, 3492],
      sidePotThenNeedlessFold
    );
    expect(auditor(table.hand).decision).toMatchObject({
      player: "p3",
      fold: null,
    });
    expect(table.reject(fold)).toEqual({ code: "needless_fold" });
    table.act(call);
    const record = summarizeHand(table.hand);
    expect(record?.unclaimed).toBe(0);
    expect(
      record?.pots.map((pot) => [pot.amount, pot.winners.map((w) => w.player)])
    ).toContainEqual([3450, ["p3"]]);
  });

  test("unclaimed, as in pokerkit: the fold leaves the side pot to nobody", () => {
    const table = played(
      noLimit(unclaimedCash),
      [3457, 229, 3492],
      sidePotThenNeedlessFold
    );
    table.act(fold);
    expect(summarizeHand(table.hand)?.unclaimed).toBe(3450);
  });

  const toShowdownAlone = [
    call,
    raiseTo(1954),
    call,
    call,
    call,
    raiseTo(500),
    fold,
  ];

  test("refused: the side pot's last contender must show, not muck", () => {
    const table = played(
      noLimit(conventions.tournament),
      [3457, 229, 3492],
      toShowdownAlone,
      automation.dealer
    );
    expect(auditor(table.hand).decision).toEqual({
      kind: "showdown",
      player: "p3",
      mayMuck: false,
    });
    expect(table.reject({ type: "muck" })).toEqual({ code: "must_show" });
  });

  test("unclaimed, as in pokerkit: the muck leaves the side pot to nobody", () => {
    const table = played(
      noLimit({ ...conventions.tournament, strandedPots: "unclaimed" }),
      [3457, 229, 3492],
      toShowdownAlone,
      automation.dealer
    );
    table.act({ type: "muck" });
    table.act({ type: "show" });
    expect(summarizeHand(table.hand)?.unclaimed).toBe(3450);
  });
});

describe("actAs", () => {
  const opened = () => {
    const started = startHand({
      game: noLimit(conventions.tda2024),
      players: ["ann", "bo", "cy"],
      stacks: [1000, 1000, 1000],
      deck: cards("AsKsQsJsTs9s8s7s6s5s4s3s2s"),
      automate: automation.all,
    });
    if (!started.ok) throw new Error(JSON.stringify(started.error));
    return started.value.hand;
  };

  test("acts for the authenticated player, whoever the action names", () => {
    const hand = opened();
    const acted = actAs(
      hand,
      "cy",
      { type: "checkOrCall", player: "ann" },
      { expectedVersion: auditor(hand).version }
    );
    expect(acted.ok && acted.value.events[0]?.body).toEqual({
      type: "called",
      player: "cy",
      amount: 100,
      allIn: false,
    });
  });

  test("refuses another seat's turn and a stale version", () => {
    const hand = opened();
    const version = auditor(hand).version;
    expect(
      actAs(hand, "ann", { type: "fold" }, { expectedVersion: version })
    ).toEqual({
      ok: false,
      error: { code: "not_eligible", player: "ann", eligible: ["cy"] },
    });
    expect(
      actAs(hand, "cy", { type: "fold" }, { expectedVersion: version - 1 })
    ).toEqual({
      ok: false,
      error: { code: "stale_version", expected: version - 1, current: version },
    });
  });

  test("takes no dealer steps", () => {
    const deal = { type: "dealBoard" } as const;
    // @ts-expect-error a client can never deal.
    actAs(opened(), "cy", deal, { expectedVersion: 0 });
  });
});
