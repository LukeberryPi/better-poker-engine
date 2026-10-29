import { expect } from "bun:test";

import { doctest, type Example } from "../../../../parity/harness.ts";
import type { EventBody } from "../../src/events.ts";
import { automation } from "../../src/hand.ts";
import { holdem } from "../../src/rules.ts";
import type { Pot } from "../../src/views.ts";
import {
  allBut,
  auditor,
  boardDealt,
  burn,
  burned,
  called,
  checkOrCall,
  checked,
  dealBoard,
  dealHole,
  drive,
  holeDealt,
  potAmounts,
  start,
  steps,
  totalPot,
  type Driver,
} from "../driver.ts";

const sixHanded = holdem.noLimit({
  blinds: [1, 2],
  minBet: 2,
  anteTrimming: true,
});

function sixHandedHand(): Driver {
  const automate = allBut("boardDealing", "runoutCountSelection");
  return drive(start(sixHanded, [50, 100, 200, 1000, 200, 100], automate));
}

function raised(player: string, to: number, allIn: boolean): EventBody {
  return { type: "betOrRaised", player, kind: "raise", to, allIn };
}

/** pot_amounts and pots share a pre-flop where everyone but p4 ends all-in. */
function allInPreflop(example: Example, table: () => Driver): void {
  steps(example, table, [
    [6, { type: "betOrRaiseTo", amount: 200 }, raised("p3", 200, true)],
  ]);
  example(7, () => {
    expect(table().reject({ type: "betOrRaiseTo", amount: 1000 })).toEqual({
      code: "everyone_else_all_in",
    });
  });
  steps(example, table, [
    [8, checkOrCall, called("p4", 200)],
    [
      9,
      checkOrCall,
      { type: "called", player: "p5", amount: 200, allIn: true },
    ],
    [
      10,
      checkOrCall,
      { type: "called", player: "p6", amount: 100, allIn: true },
    ],
    [
      11,
      checkOrCall,
      { type: "called", player: "p1", amount: 49, allIn: true },
    ],
  ]);
}

function dealsBoards(example: Example, table: () => Driver): void {
  for (const [index, count] of [
    [20, 3],
    [21, 1],
    [22, 1],
  ] as const) {
    example(index, () => {
      const body = table().act({ type: "dealBoard" });
      expect(body.type === "boardDealt" ? body.cards.length : null).toBe(count);
    });
  }
}

doctest("pokerkit.state.State.pot_amounts", (example) => {
  let table: Driver;
  let amounts: number[];
  example(1, () => {});
  example(2, () => {
    table = sixHandedHand();
  });
  example(3, () => {
    amounts = potAmounts(table.hand);
  });
  example(4, () => expect(amounts[0]).toBeUndefined());
  example(5, () => expect(amounts).toEqual([]));
  allInPreflop(example, () => table);
  example(12, () => expect(potAmounts(table.hand)).toEqual([]));
  steps(example, () => table, [
    [
      13,
      checkOrCall,
      { type: "called", player: "p2", amount: 98, allIn: true },
    ],
  ]);
  example(14, () => expect(potAmounts(table.hand)[0]).toBe(300));
  example(15, () => {
    amounts = potAmounts(table.hand);
  });
  example(16, () => expect(amounts).toHaveLength(3));
  example(17, () => expect(amounts[0]).toBe(300));
  example(18, () => expect(amounts[1]).toBe(250));
  example(19, () => expect(amounts[2]).toBe(300));
  dealsBoards(example, () => table);
});

doctest("pokerkit.state.State.total_pot_amount", (example) => {
  const game = holdem.noLimit({
    antes: { kind: "byPosition", amounts: [0, 2] },
    blinds: [1, 2],
    minBet: 2,
  });
  let table: Driver;
  const total = (amount: number) => () =>
    expect(totalPot(table.hand)).toBe(amount);
  example(1, () => {});
  example(2, () => {
    table = drive(start(game, [200, 200], automation.none));
  });
  example(3, total(0));
  steps(example, () => table, [
    [4, { type: "postAnte" }, { type: "antePosted", player: "p1", amount: 2 }],
  ]);
  example(5, total(2));
  steps(example, () => table, [
    [
      6,
      { type: "collectBets" },
      { type: "betsCollected", collected: 2, returned: [] },
    ],
  ]);
  example(7, total(2));
  steps(example, () => table, [
    [
      8,
      { type: "postBlind" },
      { type: "blindPosted", player: "p1", amount: 2 },
    ],
  ]);
  example(9, total(4));
  steps(example, () => table, [
    [
      10,
      { type: "postBlind" },
      { type: "blindPosted", player: "p2", amount: 1 },
    ],
  ]);
  example(11, total(5));
  steps(example, () => table, [
    [12, dealHole("Ac"), holeDealt("p1", "Ac")],
    [13, dealHole("Kc"), holeDealt("p2", "Kc")],
    [14, dealHole("Ad"), holeDealt("p1", "Ad")],
    [15, dealHole("Kd"), holeDealt("p2", "Kd")],
  ]);
  example(16, total(5));
  steps(example, () => table, [[17, checkOrCall, called("p2", 1)]]);
  example(18, total(6));
  steps(example, () => table, [
    [19, checkOrCall, checked("p1")],
    [
      20,
      { type: "collectBets" },
      { type: "betsCollected", collected: 4, returned: [] },
    ],
    [21, burn("2c"), burned("2c")],
    [22, dealBoard("AhKhAs"), boardDealt("AhKhAs")],
    [23, checkOrCall, checked("p1")],
    [24, checkOrCall, checked("p2")],
    [25, burn("2d"), burned("2d")],
    [26, dealBoard("Ks"), boardDealt("Ks")],
    [27, checkOrCall, checked("p1")],
  ]);
  example(28, total(6));
  steps(example, () => table, [
    [
      29,
      { type: "betOrRaiseTo", amount: 10 },
      { type: "betOrRaised", player: "p2", kind: "bet", to: 10, allIn: false },
    ],
  ]);
  example(30, total(16));
  steps(example, () => table, [
    [
      31,
      { type: "betOrRaiseTo", amount: 30 },
      {
        type: "betOrRaised",
        player: "p1",
        kind: "raise",
        to: 30,
        allIn: false,
      },
    ],
  ]);
  example(32, total(46));
  steps(example, () => table, [
    [33, checkOrCall, called("p2", 20)],
    [
      34,
      { type: "collectBets" },
      { type: "betsCollected", collected: 60, returned: [] },
    ],
  ]);
  example(35, total(66));
  steps(example, () => table, [
    [36, burn("2h"), burned("2h")],
    [37, dealBoard("2s"), boardDealt("2s")],
    [38, checkOrCall, checked("p1")],
    [39, checkOrCall, checked("p2")],
    [
      40,
      { type: "timeout" },
      { type: "shown", player: "p1", cards: ["Ac", "Ad"] },
    ],
    [41, { type: "timeout" }, { type: "mucked", player: "p2" }],
    [
      42,
      { type: "pushChips" },
      {
        type: "chipsPushed",
        pot: 0,
        board: null,
        handType: null,
        awards: [{ player: "p1", amount: 66 }],
        unclaimed: 0,
      },
    ],
  ]);
  example(43, total(66));
  steps(example, () => table, [
    [
      44,
      { type: "pullChips" },
      { type: "chipsPulled", player: "p1", amount: 66 },
    ],
  ]);
  example(45, total(0));
  example(46, () => {
    const automate = allBut("runoutCountSelection");
    table = drive(start(game, [200, 200], automate));
  });
  example(47, total(5));
  steps(example, () => table, [
    [48, { type: "fold" }, { type: "folded", player: "p2", needless: false }],
  ]);
  example(49, total(0));
});

doctest("pokerkit.state.State.pots", (example) => {
  let table: Driver;
  let pots: readonly Pot[];
  const potsOf = () => auditor(table.hand).pots;
  example(1, () => {});
  example(2, () => {
    table = sixHandedHand();
  });
  example(3, () => {
    pots = potsOf();
  });
  example(4, () => expect(pots[0]).toBeUndefined());
  example(5, () => expect(pots).toEqual([]));
  allInPreflop(example, () => table);
  example(12, () => expect(potsOf()).toEqual([]));
  steps(example, () => table, [
    [
      13,
      checkOrCall,
      { type: "called", player: "p2", amount: 98, allIn: true },
    ],
  ]);
  const everyone = ["p1", "p2", "p3", "p4", "p5", "p6"];
  example(14, () => {
    expect(potsOf()[0]).toEqual({ amount: 300, raked: 0, eligible: everyone });
  });
  example(15, () => {
    pots = potsOf();
  });
  example(16, () => expect(pots).toHaveLength(3));
  example(17, () => {
    expect(pots[0]).toEqual({ amount: 300, raked: 0, eligible: everyone });
  });
  example(18, () => {
    expect(pots[1]).toEqual({
      amount: 250,
      raked: 0,
      eligible: ["p2", "p3", "p4", "p5", "p6"],
    });
  });
  example(19, () => {
    expect(pots[2]).toEqual({
      amount: 300,
      raked: 0,
      eligible: ["p3", "p4", "p5"],
    });
  });
  dealsBoards(example, () => table);
});
