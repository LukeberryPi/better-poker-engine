import { expect } from "bun:test";

import { doctest, type Example } from "../../../../parity/harness.ts";
import type { PlayerId } from "../../src/hand.ts";
import { draw, holdem } from "../../src/rules.ts";
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
  pending,
  start,
  steps,
  type Driver,
  type Step,
} from "../driver.ts";

const threeHanded = holdem.noLimit({ blinds: [1, 2], minBet: 2 });
const forcedOnly = ["antePosting", "betCollection", "blindPosting"] as const;

function checkedDown(): Driver {
  return drive(start(threeHanded, [200, 200, 200], forcedOnly));
}

/** showdown_index and can_show_or_muck_hole_cards check down to the river's last check. */
function toLastCheck(example: Example, table: () => Driver): void {
  const list: Step[] = [
    [3, dealHole("JcJd"), holeDealt("p1", "JcJd")],
    [4, dealHole("KcKd"), holeDealt("p2", "KcKd")],
    [5, dealHole("QcQd"), holeDealt("p3", "QcQd")],
    [
      6,
      { type: "betOrRaiseTo", amount: 6 },
      { type: "betOrRaised", player: "p3", kind: "raise", to: 6, allIn: false },
    ],
    [7, checkOrCall, called("p1", 5)],
    [8, checkOrCall, called("p2", 4)],
  ];
  let index = 9;
  for (const board of ["AcAdAh", "2c", "2d"]) {
    list.push([index, burn("??"), burned("??")]);
    list.push([index + 1, dealBoard(board), boardDealt(board)]);
    list.push([index + 2, checkOrCall, checked("p1")]);
    list.push([index + 3, checkOrCall, checked("p2")]);
    if (index < 19) list.push([index + 4, checkOrCall, checked("p3")]);
    index += 5;
  }
  steps(example, table, list);
}

const showdownSteps: readonly Step[] = [
  [
    26,
    { type: "timeout" },
    { type: "shown", player: "p1", cards: ["Jc", "Jd"] },
  ],
  [
    28,
    { type: "timeout" },
    { type: "shown", player: "p2", cards: ["Kc", "Kd"] },
  ],
  [30, { type: "timeout" }, { type: "mucked", player: "p3" }],
];

doctest("pokerkit.state.State.showdown_index", (example) => {
  let table: Driver;
  const showdownPlayer = (): PlayerId | null => {
    const decision = auditor(table.hand).decision;
    return decision.kind === "showdown" ? decision.player : null;
  };
  example(1, () => {});
  example(2, () => {
    table = checkedDown();
  });
  toLastCheck(example, () => table);
  example(23, () => expect(showdownPlayer()).toBeNull());
  steps(example, () => table, [[24, checkOrCall, checked("p3")]]);
  example(25, () => expect(showdownPlayer()).toBe("p1"));
  steps(example, () => table, showdownSteps.slice(0, 1));
  example(27, () => expect(showdownPlayer()).toBe("p2"));
  steps(example, () => table, showdownSteps.slice(1, 2));
  example(29, () => expect(showdownPlayer()).toBe("p3"));
  steps(example, () => table, showdownSteps.slice(2));
});

doctest("pokerkit.state.State.can_show_or_muck_hole_cards", (example) => {
  let table: Driver;
  const canShowOrMuck = () =>
    table.can({ type: "show" }) || table.can({ type: "muck" });
  example(1, () => {});
  example(2, () => {
    table = checkedDown();
  });
  toLastCheck(example, () => table);
  example(23, () => expect(canShowOrMuck()).toBe(false));
  steps(example, () => table, [[24, checkOrCall, checked("p3")]]);
  example(25, () => expect(canShowOrMuck()).toBe(true));
  steps(example, () => table, showdownSteps.slice(0, 1));
  example(27, () => expect(table.can({ type: "muck" })).toBe(true));
  steps(example, () => table, showdownSteps.slice(1, 2));
  example(29, () => expect(table.can({ type: "show" })).toBe(true));
  steps(example, () => table, showdownSteps.slice(2));
});

function allInPreflop(example: Example, table: () => Driver): void {
  steps(example, table, [
    [3, dealHole("JcJd"), holeDealt("p1", "JcJd")],
    [4, dealHole("QcQd"), holeDealt("p2", "QcQd")],
    [5, dealHole("KcKd"), holeDealt("p3", "KcKd")],
    [
      6,
      { type: "betOrRaiseTo", amount: 200 },
      {
        type: "betOrRaised",
        player: "p3",
        kind: "raise",
        to: 200,
        allIn: true,
      },
    ],
    [
      7,
      checkOrCall,
      { type: "called", player: "p1", amount: 199, allIn: true },
    ],
    [
      8,
      checkOrCall,
      { type: "called", player: "p2", amount: 198, allIn: true },
    ],
    [9, burn("??"), burned("??")],
    [10, dealBoard("AcAdAh"), boardDealt("AcAdAh")],
    [11, burn("??"), burned("??")],
    [12, dealBoard("2c"), boardDealt("2c")],
  ]);
}

function allInHand(): Driver {
  const automate = [...forcedOnly, "holeCardsShowingOrMucking"] as const;
  return drive(start(threeHanded, [200, 200, 200], automate));
}

doctest("pokerkit.state.State.hand_killing_indices", (example) => {
  let table: Driver;
  let killable: PlayerId[];
  example(1, () => {});
  example(2, () => {
    table = allInHand();
  });
  allInPreflop(example, () => table);
  example(13, () => {
    killable = pending(table.hand, "handKilling");
  });
  example(14, () => expect(killable).toEqual([]));
  steps(example, () => table, [
    [15, burn("??"), burned("??")],
    [16, dealBoard("2d"), boardDealt("2d")],
  ]);
  example(17, () => {
    expect(pending(table.hand, "handKilling")).toEqual(["p1", "p2"]);
  });
});

doctest("pokerkit.state.State.can_kill_hand", (example) => {
  let table: Driver;
  const canKill = (player?: PlayerId) =>
    table.can(
      player === undefined ? { type: "killHand" } : { type: "killHand", player }
    );
  example(1, () => {});
  example(2, () => {
    table = allInHand();
  });
  allInPreflop(example, () => table);
  example(13, () => expect(canKill()).toBe(false));
  steps(example, () => table, [
    [14, burn("??"), burned("??")],
    [15, dealBoard("2d"), boardDealt("2d")],
  ]);
  example(16, () => expect(canKill()).toBe(true));
  example(17, () => expect(canKill("p1")).toBe(true));
  example(18, () => expect(canKill("p2")).toBe(true));
  example(19, () => expect(canKill("p3")).toBe(false));
});

function tripleDraw(pushing: boolean): Driver {
  const game = draw.deuceToSevenTriple({
    blinds: [1, 2],
    smallBet: 2,
    bigBet: 4,
  });
  const manual = pushing
    ? (["chipsPulling", "runoutCountSelection"] as const)
    : (["chipsPushing", "chipsPulling", "runoutCountSelection"] as const);
  return drive(start(game, [200, 200, 200], allBut(...manual)));
}

const foldsToBigBlind: readonly Step[] = [
  [0, { type: "fold" }, { type: "folded", player: "p3", needless: false }],
  [1, { type: "fold" }, { type: "folded", player: "p1", needless: false }],
];

function numbered(from: number, list: readonly Step[]): Step[] {
  return list.map(([offset, action, body]) => [from + offset, action, body]);
}

doctest("pokerkit.state.State.can_push_chips", (example) => {
  let table: Driver;
  example(1, () => {});
  example(2, () => {
    table = tripleDraw(false);
  });
  example(3, () => expect(table.can({ type: "pushChips" })).toBe(false));
  steps(example, () => table, numbered(4, foldsToBigBlind));
  example(6, () => expect(table.can({ type: "pushChips" })).toBe(true));
});

doctest("pokerkit.state.State.chips_pulling_indices", (example) => {
  let table: Driver;
  let pullers: PlayerId[];
  example(1, () => {});
  example(2, () => {
    table = tripleDraw(true);
  });
  example(3, () => {
    pullers = pending(table.hand, "chipsPulling");
  });
  example(4, () => expect(pullers).toEqual([]));
  steps(example, () => table, numbered(5, foldsToBigBlind));
  example(7, () => expect(pending(table.hand, "chipsPulling")).toEqual(["p2"]));
});

doctest("pokerkit.state.State.can_pull_chips", (example) => {
  let table: Driver;
  const canPull = (player?: PlayerId) =>
    table.can(
      player === undefined
        ? { type: "pullChips" }
        : { type: "pullChips", player }
    );
  example(1, () => {});
  example(2, () => {
    table = tripleDraw(true);
  });
  example(3, () => expect(canPull()).toBe(false));
  steps(example, () => table, numbered(4, foldsToBigBlind));
  example(6, () => expect(canPull()).toBe(true));
  example(7, () => expect(canPull("p1")).toBe(false));
  example(8, () => expect(canPull("p2")).toBe(true));
  example(9, () => expect(canPull("p3")).toBe(false));
});
