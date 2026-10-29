import { expect } from "bun:test";

import { doctest } from "../../../../parity/harness.ts";
import type { DoctestId } from "../../../../parity/manifest.ts";
import { rankOrders, type Rank } from "../../src/cards.ts";
import { handRules } from "../../src/evaluation.ts";
import type { EventBody } from "../../src/events.ts";
import { summarizeHand, type Action, type PlayerId } from "../../src/hand.ts";
import { definitions } from "../../src/lookups.ts";
import {
  draw,
  holdem,
  omaha,
  shortDeck,
  stud,
  type Game,
  type Street,
} from "../../src/rules.ts";
import {
  allBut,
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
  repeat,
  stacks,
  start,
  steps,
  type Driver,
  type Step,
} from "../driver.ts";
import { cards } from "../support.ts";

/** pokerkit's examples deal, burn and select runouts by hand and automate the rest. */
const manualDealing = allBut(
  "cardBurning",
  "holeDealing",
  "boardDealing",
  "runoutCountSelection"
);

const fold: Action = { type: "fold" };

function bet(player: PlayerId, to: number): EventBody {
  return { type: "betOrRaised", player, kind: "bet", to, allIn: false };
}

function raised(player: PlayerId, to: number): EventBody {
  return { type: "betOrRaised", player, kind: "raise", to, allIn: false };
}

/** The same bet, raise or call, putting the player all in. */
function allIn(body: EventBody): EventBody {
  if (body.type !== "betOrRaised" && body.type !== "called") {
    throw new Error(`${body.type} cannot be all in`);
  }
  return { ...body, allIn: true };
}

function folded(player: PlayerId): EventBody {
  return { type: "folded", player, needless: false };
}

function drew(player: PlayerId, text: string): EventBody {
  return { type: "drew", player, discarded: cards(text) };
}

function discard(text: string): Action {
  return { type: "draw", discard: cards(text) };
}

/** A burn before each street's board cards, from example `first` on. */
function burnsAndBoards(
  first: number,
  streets: readonly (readonly [text: string, board: number])[]
): Step[] {
  return streets.flatMap(([text, board], offset): Step[] => [
    [first + 2 * offset, burn("??"), burned("??")],
    [first + 2 * offset + 1, dealBoard(text), boardDealt(text, board)],
  ]);
}

const texas = holdem.noLimit({ blinds: [1, 2], minBet: 2, anteTrimming: true });
const razz = stud.razz({
  antes: { kind: "everyone", amount: 1 },
  bringIn: 1,
  smallBet: 2,
  bigBet: 4,
  anteTrimming: true,
});

function streetTotal(game: Game, count: (street: Street) => number): number {
  return game.rules.streets.reduce((total, street) => total + count(street), 0);
}

/** pokerkit's `Poker` properties, read off a Texas hold'em and a razz game. */
function gameProperty<T>(
  id: DoctestId,
  property: (game: Game) => T,
  texasValue: T,
  razzValue: T
): void {
  doctest(id, (example) => {
    let game: Game;
    example(1, () => {
      game = texas;
    });
    example(2, () => expect(property(game)).toEqual(texasValue));
    example(3, () => {
      game = razz;
    });
    example(4, () => expect(property(game)).toEqual(razzValue));
  });
}

gameProperty(
  "pokerkit.games.Poker.button_status",
  (game) => game.rules.streets.some((street) => street.opening === "position"),
  true,
  false
);

gameProperty(
  "pokerkit.games.Poker.max_hole_card_count",
  (game) => streetTotal(game, (street) => street.hole.length),
  2,
  7
);

gameProperty(
  "pokerkit.games.Poker.max_down_card_count",
  (game) =>
    streetTotal(
      game,
      (street) => street.hole.filter((face) => face === "down").length
    ),
  2,
  3
);

gameProperty(
  "pokerkit.games.Poker.max_up_card_count",
  (game) =>
    streetTotal(
      game,
      (street) => street.hole.filter((face) => face === "up").length
    ),
  0,
  4
);

gameProperty(
  "pokerkit.games.Poker.max_board_card_count",
  (game) => streetTotal(game, (street) => street.board),
  5,
  0
);

gameProperty<readonly (readonly Rank[])[]>(
  "pokerkit.games.Poker.rank_orders",
  (game) =>
    game.rules.handTypes.map(
      (type) => definitions[handRules[type].lookup].rankOrder
    ),
  [rankOrders.standard],
  [rankOrders.regular]
);

doctest("pokerkit.games.FixedLimitTexasHoldem.create_state", (example) => {
  let table: Driver;
  example(1, () => {
    const game = holdem.fixedLimit({
      blinds: [1, 2],
      smallBet: 2,
      bigBet: 4,
      anteTrimming: true,
    });
    table = drive(
      start(
        game,
        [200, 200],
        allBut("holeDealing", "boardDealing", "runoutCountSelection")
      )
    );
  });
  steps(example, () => table, [
    [2, dealHole("AcAs"), holeDealt("p1", "AcAs")],
    [3, dealHole("7h6h"), holeDealt("p2", "7h6h")],
    [4, "minimumRaise", raised("p2", 4)],
    [5, "minimumRaise", raised("p1", 6)],
    [6, fold, folded("p2")],
  ]);
  example(7, () => expect(stacks(table.hand)).toEqual([204, 196]));
});

doctest("pokerkit.games.NoLimitTexasHoldem.create_state", (example) => {
  let table: Driver;
  example(1, () => {});
  example(2, () => {});
  example(3, () => {
    const game = holdem.noLimit({
      antes: { kind: "button", amount: 600 },
      blinds: [200, 400, 800],
      minBet: 400,
      mode: "cashGame",
    });
    table = drive(
      start(
        game,
        ["unbounded", 116400, 86900, "unbounded", 50000, "unbounded"],
        manualDealing
      )
    );
  });
  steps(example, () => table, [
    [4, dealHole("JsTh"), holeDealt("p1", "JsTh")],
    [5, dealHole("Ah9d"), holeDealt("p2", "Ah9d")],
    [6, dealHole("KsKc"), holeDealt("p3", "KsKc")],
    [7, dealHole("5c2h"), holeDealt("p4", "5c2h")],
    [8, dealHole("6h5h"), holeDealt("p5", "6h5h")],
    [9, dealHole("6s3s"), holeDealt("p6", "6s3s")],
    [10, fold, folded("p4")],
    [11, { type: "betOrRaiseTo", amount: 2800 }, raised("p5", 2800)],
    [12, fold, folded("p6")],
    [13, checkOrCall, called("p1", 2600)],
    [14, { type: "betOrRaiseTo", amount: 12600 }, raised("p2", 12600)],
    [15, checkOrCall, called("p3", 11800)],
    [16, checkOrCall, called("p5", 9800)],
    [17, checkOrCall, called("p1", 9800)],
    [18, burn("??"), burned("??")],
    [19, dealBoard("9hTs9s"), boardDealt("9hTs9s")],
    [20, checkOrCall, checked("p1")],
    [21, { type: "betOrRaiseTo", amount: 17000 }, bet("p2", 17000)],
    [22, { type: "betOrRaiseTo", amount: 36000 }, raised("p3", 36000)],
    [23, fold, folded("p5")],
    [24, fold, folded("p1")],
    [25, { type: "betOrRaiseTo", amount: 103800 }, allIn(raised("p2", 103800))],
    [26, checkOrCall, allIn(called("p3", 38300))],
    [
      27,
      { type: "selectRunoutCount", count: 4 },
      { type: "runoutCountSelected", player: "p2", count: 4 },
    ],
    [
      28,
      { type: "selectRunoutCount", count: null },
      { type: "runoutCountSelected", player: "p3", count: null },
    ],
    ...burnsAndBoards(29, [
      ["Jh", 0],
      ["Ad", 0],
      ["Kh", 1],
      ["3c", 1],
      ["7s", 2],
      ["8s", 2],
      ["Qc", 3],
      ["Kd", 3],
    ]),
  ]);
  example(45, () => {
    expect(stacks(table.hand)).toEqual([
      "unbounded",
      79400,
      149700,
      "unbounded",
      37400,
      "unbounded",
    ]);
    expect(summarizeHand(table.hand)?.players.map(({ net }) => net)).toEqual([
      -12600, -37000, 62800, 0, -12600, -600,
    ]);
  });
  example(46, () => {
    const game = holdem.noLimit({
      antes: { kind: "everyone", amount: 500 },
      blinds: [1000, 2000],
      minBet: 2000,
      anteTrimming: true,
    });
    table = drive(start(game, [1125600, "unbounded", 553500], manualDealing));
  });
  steps(example, () => table, [
    [47, dealHole("Ac2d"), holeDealt("p1", "Ac2d")],
    [48, dealHole("????"), holeDealt("p2", "????")],
    [49, dealHole("7h6h"), holeDealt("p3", "7h6h")],
    [50, { type: "betOrRaiseTo", amount: 7000 }, raised("p3", 7000)],
    [51, { type: "betOrRaiseTo", amount: 23000 }, raised("p1", 23000)],
    [52, fold, folded("p2")],
    [53, checkOrCall, called("p3", 16000)],
    ...burnsAndBoards(54, [["Jc3d5c", 0]]),
    [56, { type: "betOrRaiseTo", amount: 35000 }, bet("p1", 35000)],
    [57, checkOrCall, called("p3", 35000)],
    ...burnsAndBoards(58, [["4h", 0]]),
    [60, { type: "betOrRaiseTo", amount: 90000 }, bet("p1", 90000)],
    [61, { type: "betOrRaiseTo", amount: 232600 }, raised("p3", 232600)],
    [
      62,
      { type: "betOrRaiseTo", amount: 1067100 },
      allIn(raised("p1", 1067100)),
    ],
    [63, checkOrCall, allIn(called("p3", 262400))],
    ...burnsAndBoards(64, [["Jh", 0]]),
  ]);
  example(66, () => {
    expect(stacks(table.hand)).toEqual([572100, "unbounded", 1109500]);
  });
});

doctest("pokerkit.games.NoLimitShortDeckHoldem.create_state", (example) => {
  let table: Driver;
  example(1, () => {
    const game = shortDeck.noLimit({
      antes: { kind: "everyone", amount: 3000 },
      blinds: [0, 0, 0, 0, 0, 3000],
      minBet: 3000,
      anteTrimming: true,
    });
    const startingStacks = [495000, 232000, 362000, 403000, 301000, 204000];
    table = drive(start(game, startingStacks, manualDealing));
  });
  steps(example, () => table, [
    [2, dealHole("Th8h"), holeDealt("p1", "Th8h")],
    [3, dealHole("QsJd"), holeDealt("p2", "QsJd")],
    [4, dealHole("QhQd"), holeDealt("p3", "QhQd")],
    [5, dealHole("8d7c"), holeDealt("p4", "8d7c")],
    [6, dealHole("KhKs"), holeDealt("p5", "KhKs")],
    [7, dealHole("8c7h"), holeDealt("p6", "8c7h")],
    [8, checkOrCall, called("p1", 3000)],
    [9, checkOrCall, called("p2", 3000)],
    [10, { type: "betOrRaiseTo", amount: 35000 }, raised("p3", 35000)],
    [11, fold, folded("p4")],
    [12, { type: "betOrRaiseTo", amount: 298000 }, allIn(raised("p5", 298000))],
    [13, fold, folded("p6")],
    [14, fold, folded("p1")],
    [15, fold, folded("p2")],
    [16, checkOrCall, called("p3", 263000)],
    ...burnsAndBoards(17, [
      ["9h6cKc", 0],
      ["Jh", 0],
      ["Ts", 0],
    ]),
  ]);
  example(23, () => {
    expect(stacks(table.hand)).toEqual([
      489000, 226000, 684000, 400000, 0, 198000,
    ]);
  });
});

doctest("pokerkit.games.PotLimitOmahaHoldem.create_state", (example) => {
  let table: Driver;
  example(1, () => {
    const game = omaha.potLimit({
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: true,
    });
    table = drive(start(game, [125945025, 67847350], manualDealing));
  });
  steps(example, () => table, [
    [2, dealHole("Ah3sKsKh"), holeDealt("p1", "Ah3sKsKh")],
    [3, dealHole("6d9s7d8h"), holeDealt("p2", "6d9s7d8h")],
    [4, { type: "betOrRaiseTo", amount: 300000 }, raised("p2", 300000)],
    [5, { type: "betOrRaiseTo", amount: 900000 }, raised("p1", 900000)],
    [6, { type: "betOrRaiseTo", amount: 2700000 }, raised("p2", 2700000)],
    [7, { type: "betOrRaiseTo", amount: 8100000 }, raised("p1", 8100000)],
    [8, checkOrCall, called("p2", 5400000)],
    ...burnsAndBoards(9, [["4s5c2h", 0]]),
    [11, { type: "betOrRaiseTo", amount: 9100000 }, bet("p1", 9100000)],
    [12, { type: "betOrRaiseTo", amount: 43500000 }, raised("p2", 43500000)],
    [13, { type: "betOrRaiseTo", amount: 77900000 }, raised("p1", 77900000)],
    [14, checkOrCall, allIn(called("p2", 16247350))],
    ...burnsAndBoards(15, [
      ["5h", 0],
      ["9c", 0],
    ]),
  ]);
  example(19, () => expect(stacks(table.hand)).toEqual([193792375, 0]));
});

doctest(
  "pokerkit.games.FixedLimitDeuceToSevenLowballTripleDraw.create_state",
  (example) => {
    let table: Driver;
    example(1, () => {
      const game = draw.deuceToSevenTriple({
        blinds: [75000, 150000],
        smallBet: 150000,
        bigBet: 300000,
        anteTrimming: true,
      });
      const startingStacks = [1180000, 4340000, 5910000, 10765000];
      table = drive(start(game, startingStacks, manualDealing));
    });
    steps(example, () => table, [
      [2, dealHole("7h6c4c3d2c"), holeDealt("p1", "7h6c4c3d2c")],
      [3, dealHole("??????????"), holeDealt("p2", "??????????")],
      [4, dealHole("??????????"), holeDealt("p3", "??????????")],
      [5, dealHole("AsQs6s5c3c"), holeDealt("p4", "AsQs6s5c3c")],
      [6, fold, folded("p3")],
      [7, "minimumRaise", raised("p4", 300000)],
      [8, "minimumRaise", raised("p1", 450000)],
      [9, fold, folded("p2")],
      [10, checkOrCall, called("p4", 150000)],
      [11, discard(""), drew("p1", "")],
      [12, discard("AsQs"), drew("p4", "AsQs")],
      [13, burn("??"), burned("??")],
      [14, dealHole("2hQh"), holeDealt("p4", "2hQh")],
      [15, "minimumRaise", bet("p1", 150000)],
      [16, checkOrCall, called("p4", 150000)],
      [17, discard(""), drew("p1", "")],
      [18, discard("Qh"), drew("p4", "Qh")],
      [19, burn("??"), burned("??")],
      [20, dealHole("4d"), holeDealt("p4", "4d")],
      [21, "minimumRaise", bet("p1", 300000)],
      [22, checkOrCall, called("p4", 300000)],
      [23, discard(""), drew("p1", "")],
      [24, discard("6s"), drew("p4", "6s")],
      [25, burn("??"), burned("??")],
      [26, dealHole("7c"), holeDealt("p4", "7c")],
      [27, "minimumRaise", allIn(bet("p1", 280000))],
      [28, checkOrCall, called("p4", 280000)],
    ]);
    example(29, () => {
      expect(stacks(table.hand)).toEqual([0, 4190000, 5910000, 12095000]);
    });
  }
);

doctest("pokerkit.games.FixedLimitBadugi.create_state", (example) => {
  let table: Driver;
  example(1, () => {});
  example(2, () => {
    const game = draw.badugi({
      blinds: [1, 2],
      smallBet: 2,
      bigBet: 4,
      anteTrimming: true,
    });
    table = drive(
      start(
        game,
        repeat("unbounded", 4),
        allBut(
          "cardBurning",
          "holeDealing",
          "boardDealing",
          "runoutCountSelection",
          "holeCardsShowingOrMucking"
        )
      )
    );
  });
  steps(example, () => table, [
    [3, dealHole("????????"), holeDealt("p1", "????????")],
    [4, dealHole("????????"), holeDealt("p2", "????????")],
    [5, dealHole("????????"), holeDealt("p3", "????????")],
    [6, dealHole("????????"), holeDealt("p4", "????????")],
    [7, fold, folded("p3")],
    [8, checkOrCall, called("p4", 2)],
    [9, checkOrCall, called("p1", 1)],
    [10, checkOrCall, checked("p2")],
    [11, discard("????"), drew("p1", "????")],
    [12, discard("????"), drew("p2", "????")],
    [13, discard("??"), drew("p4", "??")],
    [14, burn("??"), burned("??")],
    [15, dealHole("????"), holeDealt("p1", "????")],
    [16, dealHole("????"), holeDealt("p2", "????")],
    [17, dealHole("??"), holeDealt("p4", "??")],
    [18, checkOrCall, checked("p1")],
    [19, "minimumRaise", bet("p2", 2)],
    [20, checkOrCall, called("p4", 2)],
    [21, checkOrCall, called("p1", 2)],
    [22, discard("??"), drew("p1", "??")],
    [23, discard(""), drew("p2", "")],
    [24, discard("??"), drew("p4", "??")],
    [25, burn("??"), burned("??")],
    [26, dealHole("??"), holeDealt("p1", "??")],
    [27, dealHole("??"), holeDealt("p4", "??")],
    [28, checkOrCall, checked("p1")],
    [29, "minimumRaise", bet("p2", 4)],
    [30, "minimumRaise", raised("p4", 8)],
    [31, fold, folded("p1")],
    [32, checkOrCall, called("p2", 4)],
    [33, discard("??"), drew("p2", "??")],
    [34, discard(""), drew("p4", "")],
    [35, burn("??"), burned("??")],
    [36, dealHole("??"), holeDealt("p2", "??")],
    [37, checkOrCall, checked("p2")],
    [38, "minimumRaise", bet("p4", 4)],
    [39, checkOrCall, called("p2", 4)],
    [
      40,
      { type: "show", cards: cards("2s4c6d9h") },
      { type: "shown", player: "p4", cards: cards("2s4c6d9h") },
    ],
    [
      41,
      { type: "show", cards: cards("3s5d7c8h") },
      { type: "shown", player: "p2", cards: cards("3s5d7c8h") },
    ],
  ]);
  example(42, () => {
    expect(stacks(table.hand)).toEqual(repeat("unbounded", 4));
  });
  example(43, () => {
    expect(summarizeHand(table.hand)?.players.map(({ net }) => net)).toEqual([
      -4, 20, 0, -16,
    ]);
  });
});
