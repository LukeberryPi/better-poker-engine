import { expect } from "bun:test";

import { doctest, type Example } from "../../../../parity/harness.ts";
import type { Card } from "../../src/cards.ts";
import { describeHand, type HandValue } from "../../src/evaluation.ts";
import type { Hand } from "../../src/hand.ts";
import { holdem, stud } from "../../src/rules.ts";
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
  holeCards,
  holeDealt,
  spectator,
  start,
  steps,
  type Driver,
  type Step,
} from "../driver.ts";

const studAutomation = allBut("holeDealing", "runoutCountSelection");
const studStakes = { bringIn: 1, smallBet: 2, bigBet: 4, anteTrimming: true };
const studUp = ["down", "down", "up"] as const;

doctest("pokerkit.state.State.get_censored_hole_cards", (example) => {
  let table: Driver;
  let downCards: Card[];
  example(1, () => {});
  example(2, () => {
    const game = stud.fixedLimitHiLo(studStakes);
    table = drive(start(game, [50, 100], studAutomation));
  });
  steps(example, () => table, [
    [3, dealHole("AcAdAh"), holeDealt("p1", "AcAdAh", studUp)],
    [4, dealHole("KcKdKh"), holeDealt("p2", "KcKdKh", studUp)],
  ]);
  example(5, () => {
    downCards = holeCards(auditor(table.hand), 0, "down");
    expect(downCards).toEqual(["Ac", "Ad"]);
  });
  const censored = (position: number) =>
    spectator(table.hand).players[position]?.holeCards.map(({ card }) => card);
  example(6, () => expect(censored(0)).toEqual(["??", "??", "Ah"]));
  example(7, () => expect(censored(1)).toEqual(["??", "??", "Kh"]));
});

function studHand(): Driver {
  return drive(start(stud.fixedLimit(studStakes), [50, 100], studAutomation));
}

const studOpening: readonly Step[] = [
  [3, dealHole("AcAdAh"), holeDealt("p1", "AcAdAh", studUp)],
  [4, dealHole("KcKdKh"), holeDealt("p2", "KcKdKh", studUp)],
];

doctest("pokerkit.state.State.get_down_cards", (example) => {
  let table: Driver;
  let downCards: Card[];
  const down = (position: number) =>
    holeCards(auditor(table.hand), position, "down");
  example(1, () => {});
  example(2, () => {
    table = studHand();
  });
  steps(example, () => table, studOpening);
  example(5, () => {
    downCards = down(0);
  });
  example(6, () => expect(downCards).toEqual(["Ac", "Ad"]));
  example(7, () => expect(down(1)).toEqual(["Kc", "Kd"]));
  steps(example, () => table, [
    [
      8,
      { type: "postBringIn" },
      { type: "bringInPosted", player: "p2", amount: 1 },
    ],
    [9, { type: "fold" }, { type: "folded", player: "p1", needless: false }],
  ]);
  example(10, () => expect(down(0)).toEqual([]));
  example(11, () => expect(down(1)).toEqual(["Kc", "Kd"]));
});

doctest("pokerkit.state.State.get_up_cards", (example) => {
  let table: Driver;
  const up = (position: number) =>
    holeCards(spectator(table.hand), position, "up");
  example(1, () => {});
  example(2, () => {
    table = studHand();
  });
  steps(example, () => table, studOpening);
  example(5, () => {
    expect(holeCards(auditor(table.hand), 0, "down")).toEqual(["Ac", "Ad"]);
  });
  example(6, () => expect(up(0)).toEqual(["Ah"]));
  example(7, () => expect(up(1)).toEqual(["Kh"]));
  steps(example, () => table, [
    [
      8,
      { type: "postBringIn" },
      { type: "bringInPosted", player: "p2", amount: 1 },
    ],
    [9, { type: "fold" }, { type: "folded", player: "p1", needless: false }],
  ]);
  example(10, () => expect(up(0)).toEqual([]));
  example(11, () => expect(up(1)).toEqual(["Kh"]));
});

const holdemGame = holdem.noLimit({
  blinds: [1, 2],
  minBet: 2,
  anteTrimming: true,
});

function holdemHand(showing: boolean): Driver {
  const manual = [
    "cardBurning",
    "holeDealing",
    "boardDealing",
    "runoutCountSelection",
  ] as const;
  const automate = showing
    ? allBut(...manual)
    : allBut(...manual, "holeCardsShowingOrMucking");
  return drive(start(holdemGame, [50, 100], automate));
}

/** A checked-down hand; `from` numbers the first example, `skip` the examples between streets. */
function checkDown(
  from: number,
  holes: readonly [string, string],
  gaps: readonly number[]
): Step[] {
  const list: Step[] = [];
  let index = from;
  const add = (step: Step[1], body: Step[2]) => {
    list.push([index, step, body]);
    index += 1;
  };
  add(dealHole(holes[0]), holeDealt("p1", holes[0]));
  add(dealHole(holes[1]), holeDealt("p2", holes[1]));
  index += gaps[0] ?? 0;
  add(checkOrCall, called("p2", 1));
  add(checkOrCall, checked("p1"));
  for (const [street, board] of ["JsTs2c", "Ah", "As"].entries()) {
    add(burn("??"), burned("??"));
    add(dealBoard(board), boardDealt(board));
    index += gaps[street + 1] ?? 0;
    add(checkOrCall, checked("p1"));
    add(checkOrCall, checked("p2"));
  }
  return list;
}

/** Runs examples `first` to `last` in order, each a step or a check. */
function interleave(
  example: Example,
  table: () => Driver,
  [first, last]: readonly [number, number],
  list: readonly Step[],
  checks: ReadonlyMap<number, () => void>
): void {
  const byIndex = new Map(list.map((step) => [step[0], step]));
  for (let index = first; index <= last; index += 1) {
    const step = byIndex.get(index);
    const check = checks.get(index);
    if (step !== undefined) steps(example, table, [step]);
    else if (check !== undefined) example(index, check);
    else throw new Error(`Example ${index} is neither a step nor a check`);
  }
}

function text(value: HandValue | null | undefined): string | null {
  return value === null || value === undefined ? null : describeHand(value);
}

doctest("pokerkit.state.State.get_hand", (example) => {
  let table: Driver;
  const hand = (position: number) =>
    auditor(table.hand).players[position]?.hands[0]?.[0];
  example(1, () => {});
  example(2, () => {
    table = holdemHand(true);
  });
  const checks = new Map<number, () => void>([
    [3, () => expect(hand(0)).toBeNull()],
    [4, () => expect(hand(1)).toBeNull()],
    [7, () => expect(hand(0)).toBeNull()],
    [8, () => expect(hand(1)).toBeNull()],
    [13, () => expect(hand(0)?.cards.join("")).toBe("AcAdJsTs2c")],
    [14, () => expect(text(hand(0))).toBe("One pair (AcAdJsTs2c)")],
    [15, () => expect(text(hand(1))).toBe("High card (KsQsJsTs2c)")],
    [20, () => expect(text(hand(0))).toBe("Three of a kind (AcAdJsTsAh)")],
    [21, () => expect(text(hand(1))).toBe("Straight (KsQsJsTsAh)")],
    [26, () => expect(text(hand(0))).toBe("Four of a kind (AcAdJsAhAs)")],
    [27, () => expect(text(hand(1))).toBe("Straight flush (KsQsJsTsAs)")],
    [30, () => expect(hand(0)).toBeNull()],
    [31, () => expect(text(hand(1))).toBe("Straight flush (KsQsJsTsAs)")],
  ]);
  interleave(
    example,
    () => table,
    [3, 31],
    checkDown(5, ["AcAd", "KsQs"], [2, 3, 2, 2]),
    checks
  );
});

doctest("pokerkit.state.State.get_up_hand", (example) => {
  let table: Driver;
  const upHand = (position: number) =>
    spectator(table.hand).players[position]?.hands[0]?.[0];
  example(1, () => {});
  example(2, () => {
    table = holdemHand(true);
  });
  const checks = new Map<number, () => void>([
    [3, () => expect(upHand(0)).toBeNull()],
    [4, () => expect(upHand(1)).toBeNull()],
    [7, () => expect(upHand(0)).toBeNull()],
    [8, () => expect(upHand(1)).toBeNull()],
    [13, () => expect(upHand(0)).toBeNull()],
    [14, () => expect(upHand(1)).toBeNull()],
    [19, () => expect(upHand(0)).toBeNull()],
    [20, () => expect(upHand(1)).toBeNull()],
    [25, () => expect(text(upHand(0))).toBe("One pair (JsTs2cAhAs)")],
    [26, () => expect(text(upHand(1))).toBe("One pair (JsTs2cAhAs)")],
    [29, () => expect(upHand(0)).toBeNull()],
    [30, () => expect(text(upHand(1))).toBe("Straight flush (KsQsJsTsAs)")],
  ]);
  interleave(
    example,
    () => table,
    [3, 30],
    checkDown(5, ["AcAd", "KsQs"], [2, 2, 2, 2]),
    checks
  );
});

doctest("pokerkit.state.State.get_up_hands", (example) => {
  let table: Driver;
  let upHands: (HandValue | null | undefined)[];
  const upHandsOf = (hand: Hand) =>
    spectator(hand).players.map((player) => player.hands[0]?.[0]);
  example(1, () => {});
  example(2, () => {
    table = holdemHand(true);
  });
  example(3, () => {
    upHands = upHandsOf(table.hand);
  });
  example(4, () => expect(upHands).toEqual([null, null]));
  const list = checkDown(5, ["AcAd", "KsQs"], [0, 0, 0, 0]);
  steps(example, () => table, list.slice(0, -1));
  example(20, () => {
    const cards = upHandsOf(table.hand).map((value) => value?.cards.join(""));
    expect(cards).toEqual(["JsTs2cAhAs", "JsTs2cAhAs"]);
  });
  steps(example, () => table, [[21, checkOrCall, checked("p2")]]);
  example(22, () => {
    const cards = upHandsOf(table.hand).map((value) => value?.cards.join(""));
    expect(cards).toEqual([undefined, "KsQsJsTsAs"]);
  });
});

doctest("pokerkit.state.State.can_win_now", (example) => {
  let table: Driver;
  const canWinNow = (position: number) =>
    auditor(table.hand).players[position]?.canWinNow;
  example(1, () => {});
  example(2, () => {
    table = holdemHand(false);
  });
  steps(example, () => table, checkDown(3, ["KhQh", "AcKc"], [0, 0, 0, 0]));
  example(19, () => expect(canWinNow(0)).toBe(true));
  example(20, () => expect(canWinNow(1)).toBe(true));
  steps(example, () => table, [
    [
      21,
      { type: "timeout" },
      { type: "shown", player: "p1", cards: ["Kh", "Qh"] },
    ],
  ]);
  example(22, () => expect(canWinNow(0)).toBe(true));
  example(23, () => expect(canWinNow(1)).toBe(false));
  steps(example, () => table, [
    [24, { type: "timeout" }, { type: "mucked", player: "p2" }],
  ]);
});
