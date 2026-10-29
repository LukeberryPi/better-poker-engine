import { expect } from "bun:test";

import { unitTest } from "../../../../parity/harness.ts";
import { decks, type Card } from "../../src/cards.ts";
import type { Stack } from "../../src/chips.ts";
import type { HandEvent } from "../../src/events.ts";
import {
  automation,
  startHand,
  summarizeHand,
  type Automation,
  type Decision,
  type Hand,
  type PlayerId,
} from "../../src/hand.ts";
import { lookup } from "../../src/lookups.ts";
import {
  draw,
  holdem,
  leduc,
  numeral211,
  omaha,
  rhodeIsland,
  shortDeck,
  stud,
  type Game,
  type Street,
} from "../../src/rules.ts";
import {
  accept,
  allBut,
  auditor,
  called,
  checkOrCall,
  checked,
  drive,
  inProgress,
  minimumRaise,
  moves,
  pending,
  play,
  potAmounts,
  repeat,
  stacks,
  start,
  type Driver,
  type Move,
} from "../driver.ts";
import { cards, digestSortedByEntry, forEachCombination } from "../support.ts";

const {
  deal,
  board,
  burn,
  call,
  fold,
  raise,
  raiseTo,
  bringIn,
  refuse,
  standPat,
  discardHeld,
  show,
} = moves;

function openingDigest(name: "lowHandOpening" | "highHandOpening"): string {
  return digestSortedByEntry(lookup(name), (visit) => {
    for (const size of [1, 2, 3, 4]) {
      forEachCombination(decks.standard, size, visit);
    }
  });
}

unitTest(
  "pokerkit.tests.test_state.LowHandOpeningLookupTestCase.test_get_entry",
  () => {
    expect(openingDigest("lowHandOpening")).toBe(
      "9b19d8c42e4b03661329b424d7b6c8e9"
    );
  }
);

unitTest(
  "pokerkit.tests.test_state.HighHandOpeningLookupTestCase.test_get_entry",
  () => {
    expect(openingDigest("highHandOpening")).toBe(
      "b11a0c444a528e78c5be57c7bb6db06c"
    );
  }
);

const kuhnStreet: Street = {
  burn: false,
  hole: ["down"],
  board: 0,
  draw: false,
  opening: "position",
  minCompletionBetOrRaise: 1,
  maxBetsAndRaises: null,
};

function kuhn(street: Street, forcedBets: Partial<Game["forcedBets"]>): Game {
  return {
    variant: "custom",
    rules: {
      deck: "kuhn",
      handTypes: ["kuhn"],
      streets: [street],
      structure: "fixedLimit",
    },
    forcedBets: {
      antes: { kind: "everyone", amount: 1 },
      blinds: [0, 0],
      bringIn: null,
      anteTrimming: true,
      ...forcedBets,
    },
    rake: { kind: "none" },
    mode: "tournament",
    boards: 1,
  };
}

function setupError(game: Game, stacks: readonly number[] = [2, 2]) {
  const started = startHand({ game, stacks, deck: decks.kuhn, automate: [] });
  return started.ok ? null : started.error;
}

unitTest("pokerkit.tests.test_state.StreetTestCase.test_init", () => {
  expect(setupError(kuhn({ ...kuhnStreet, board: -1 }, {}))).toEqual({
    code: "invalid_amount",
    field: "streets.0.board",
    value: -1,
  });
  const burnStreet: Street = {
    ...kuhnStreet,
    burn: true,
    hole: ["down", "down"],
  };
  expect(
    setupError(kuhn({ ...burnStreet, minCompletionBetOrRaise: 0 }, {}))
  ).toEqual({
    code: "invalid_amount",
    field: "streets.0.minCompletionBetOrRaise",
    value: 0,
  });
  expect(setupError(kuhn({ ...burnStreet, maxBetsAndRaises: -1 }, {}))).toEqual(
    {
      code: "invalid_amount",
      field: "streets.0.maxBetsAndRaises",
      value: -1,
    }
  );
});

unitTest("pokerkit.tests.test_state.StateTestCase.test_init", () => {
  const noStreets = kuhn(kuhnStreet, {});
  expect(() =>
    setupError({
      ...noStreets,
      // @ts-expect-error a game has at least one street
      rules: { ...noStreets.rules, streets: [] },
    })
  ).toThrow(TypeError);
  expect(
    setupError(kuhn({ ...kuhnStreet, burn: true, hole: [], board: 3 }, {}))
  ).toEqual({ code: "first_street_without_hole_cards" });
  expect(
    setupError(
      kuhn(kuhnStreet, { antes: { kind: "byPosition", amounts: [-1, -1] } })
    )
  ).toEqual({ code: "invalid_amount", field: "forcedBets.antes", value: -1 });
  expect(setupError(kuhn(kuhnStreet, { antes: { kind: "none" } }))).toEqual({
    code: "no_forced_bets",
  });
  expect(setupError(kuhn(kuhnStreet, {}), [2, 0])).toEqual({
    code: "invalid_stack",
    player: "p2",
    stack: 0,
  });
  expect(
    setupError(
      kuhn(kuhnStreet, { antes: { kind: "none" }, blinds: [1, 1], bringIn: 1 })
    )
  ).toEqual({ code: "blinds_with_bring_in" });
  expect(
    setupError(kuhn(kuhnStreet, { antes: { kind: "none" }, bringIn: 1 }))
  ).toEqual({ code: "bring_in_not_below_min_bet", bringIn: 1, minBet: 1 });
  expect(setupError(kuhn(kuhnStreet, { blinds: [0] }), [2])).toEqual({
    code: "player_count",
    players: 1,
  });
});

const automatedShowdown = allBut(
  "cardBurning",
  "holeDealing",
  "boardDealing",
  "runoutCountSelection"
);

/** Plays the moves and returns the stacks once the hand is over. */
function finalStacks(game: Game, start: readonly number[], script: Move[]) {
  const table = drive(startWith(game, start));
  play(table, script);
  expect(inProgress(table.hand)).toBe(false);
  return stacks(table.hand);
}

function startWith(game: Game, startingStacks: readonly number[]) {
  return start(game, startingStacks, automatedShowdown);
}

const runout = (flop: string, turn: string, river: string): Move[] => [
  burn,
  board(flop),
  burn,
  board(turn),
  burn,
  board(river),
];

unitTest("pokerkit.tests.test_state.StateTestCase.test_all_ins", () => {
  const bigBlindAnte = holdem.noLimit({
    antes: { kind: "byPosition", amounts: [0, 2] },
    blinds: [1, 2],
    minBet: 2,
  });
  expect(
    finalStacks(
      bigBlindAnte,
      [6, 4, 1],
      [
        deal("AcAd"),
        deal("KcKd"),
        deal("QcQd"),
        refuse("minimumRaise", { code: "call_is_all_in" }),
        call,
        refuse("minimumRaise", { code: "everyone_else_all_in" }),
        call,
        ...runout("QhQs2c", "3c", "4c"),
      ]
    )
  ).toEqual([6, 0, 5]);

  const antes = holdem.noLimit({
    antes: { kind: "everyone", amount: 2 },
    blinds: [1, 2],
    minBet: 2,
    anteTrimming: true,
  });
  expect(
    finalStacks(
      antes,
      [6, 4, 1],
      [
        deal("AcAd"),
        deal("KcKd"),
        deal("QcQd"),
        refuse("minimumRaise", { code: "everyone_else_all_in" }),
        call,
        ...runout("QhQs2c", "3c", "4c"),
      ]
    )
  ).toEqual([8, 0, 3]);
  expect(
    finalStacks(
      antes,
      [3, 4, 1],
      [
        deal("AcAd"),
        deal("KcKd"),
        deal("QcQd"),
        ...runout("QhQs2c", "3c", "4c"),
      ]
    )
  ).toEqual([4, 1, 3]);
  expect(
    finalStacks(
      antes,
      [3, 4, 6, 1, 2, 2],
      [
        deal("AcAd"),
        deal("KcKd"),
        deal("QcQd"),
        deal("JcJd"),
        deal("TcTd"),
        deal("9c9d"),
        refuse("minimumRaise", { code: "everyone_else_all_in" }),
        call,
        ...runout("QhQs2c", "3c", "4c"),
      ]
    )
  ).toEqual([0, 0, 18, 0, 0, 0]);

  const blinds = holdem.noLimit({
    blinds: [1, 2],
    minBet: 2,
    anteTrimming: true,
  });
  expect(
    finalStacks(
      blinds,
      [200, 2, 200],
      [
        deal("AcAd"),
        deal("KcKd"),
        deal("QcQd"),
        raiseTo(100),
        call,
        burn,
        board("QhQs2c"),
        raiseTo(100),
        call,
        burn,
        board("3c"),
        burn,
        board("4c"),
      ]
    )
  ).toEqual([0, 0, 402]);
  expect(
    finalStacks(
      blinds,
      [2, 200, 200],
      [
        deal("AcAd"),
        deal("KcKd"),
        deal("QcQd"),
        raiseTo(100),
        refuse("minimumRaise", { code: "call_is_all_in" }),
        call,
        call,
        burn,
        board("QhQs2c"),
        raiseTo(100),
        call,
        burn,
        board("3c"),
        burn,
        board("4c"),
      ]
    )
  ).toEqual([0, 0, 402]);

  const buttonBlind = shortDeck.noLimit({
    antes: { kind: "everyone", amount: 2 },
    blinds: [0, 0, 0, 0, 0, 2],
    minBet: 2,
    anteTrimming: true,
  });
  const sixHoles = [
    deal("AcAd"),
    deal("KcKd"),
    deal("QcQd"),
    deal("JcJd"),
    deal("TcTd"),
    deal("9c9d"),
  ];
  const shortRunout = runout("QhQs6c", "7c", "8c");
  expect(
    finalStacks(buttonBlind, [2, 2, 2, 2, 2, 6], [...sixHoles, ...shortRunout])
  ).toEqual([0, 0, 12, 0, 0, 4]);
  expect(
    finalStacks(
      buttonBlind,
      [2, 2, 3, 3, 2, 6],
      [...sixHoles, call, call, ...shortRunout]
    )
  ).toEqual([0, 0, 15, 0, 0, 3]);
  expect(
    finalStacks(
      buttonBlind,
      [2, 2, 3, 3, 2, 6],
      [...sixHoles, call, fold, ...shortRunout]
    )
  ).toEqual([0, 0, 14, 1, 0, 3]);
  expect(
    finalStacks(
      buttonBlind,
      [2, 2, 5, 3, 2, 6],
      [...sixHoles, call, fold, raise, call, ...shortRunout]
    )
  ).toEqual([0, 0, 18, 1, 0, 1]);

  const omahaHiLo = omaha.fixedLimitHiLo({
    antes: { kind: "everyone", amount: 100 },
    blinds: [100, 200],
    smallBet: 200,
    bigBet: 400,
    anteTrimming: true,
  });
  expect(
    finalStacks(
      omahaHiLo,
      [150, 150],
      [deal("AcAdAhAs"), deal("KcKdKhKs"), ...runout("JcJdJh", "Js", "Tc")]
    )
  ).toEqual([300, 0]);

  const sevenCardStud = stud.fixedLimit({
    bringIn: 50,
    smallBet: 200,
    bigBet: 400,
    anteTrimming: true,
  });
  const studRunout = [
    burn,
    deal("As"),
    deal("Ks"),
    deal("Qs"),
    burn,
    deal("2c"),
    deal("2d"),
    deal("2h"),
    burn,
    deal("3c"),
    deal("3d"),
    deal("3h"),
    burn,
    deal("4c"),
    deal("4d"),
    deal("4h"),
  ];
  const studHoles = [deal("AcAdAh"), deal("KcKdKh"), deal("QcQdQh")];
  expect(
    finalStacks(
      sevenCardStud,
      [200, 150, 175],
      [...studHoles, raise, call, call, ...studRunout]
    )
  ).toEqual([525, 0, 0]);
  expect(
    finalStacks(
      sevenCardStud,
      [200, 150, 175],
      [...studHoles, bringIn, call, raise, call, raise, call, ...studRunout]
    )
  ).toEqual([525, 0, 0]);
});

const tripleDraw = draw.deuceToSevenTriple({
  blinds: [1, 2],
  smallBet: 2,
  bigBet: 4,
  anteTrimming: true,
});
const sixCalls = repeat(call, 6);
const everyoneDiscards = [0, 1, 2, 3, 4, 5].map(discardHeld);

/** pokerkit's hand-built game: one no-limit street, antes of 10 and no blinds. */
function oneStreet(boardCards: number): Game {
  return {
    variant: "custom",
    rules: {
      deck: "standard",
      handTypes: ["standardHigh"],
      streets: [
        {
          burn: true,
          hole: ["down", "down"],
          board: boardCards,
          draw: false,
          opening: "position",
          minCompletionBetOrRaise: 2,
          maxBetsAndRaises: null,
        },
      ],
      structure: "noLimit",
    },
    forcedBets: {
      antes: { kind: "everyone", amount: 10 },
      blinds: [],
      bringIn: null,
      anteTrimming: true,
    },
    rake: { kind: "none" },
    mode: "tournament",
    boards: 1,
  };
}

const sixStacks = repeat(200, 6);
const dealing = [
  { type: "burnCard" },
  { type: "dealHole" },
  { type: "dealBoard" },
] as const;

/** pokerkit's can_burn_card, can_deal_hole and can_deal_board. */
function dealable(table: Driver): boolean[] {
  return dealing.map((action) => table.can(action));
}

function actor(hand: Hand): PlayerId | null {
  const decision = auditor(hand).decision;
  return decision.kind === "betting" ? decision.player : null;
}

function startedEvents(game: Game, automate: Automation): HandEvent[] {
  const started = startHand({
    game,
    stacks: sixStacks,
    deck: decks.standard,
    automate,
  });
  if (!started.ok) throw new Error(started.error.code);
  return [...started.value.events];
}

unitTest(
  "pokerkit.tests.test_state.StateTestCase.test_automated_dealing",
  () => {
    const table = drive(
      start(
        tripleDraw,
        sixStacks,
        allBut("cardBurning", "runoutCountSelection")
      )
    );
    play(table, [...sixCalls, ...everyoneDiscards, burn, call]);

    const flop = startedEvents(oneStreet(3), automation.all);
    expect(
      dealable(drive(start(oneStreet(3), sixStacks, automation.all)))
    ).toEqual([false, false, false]);
    expect(actor(start(oneStreet(3), sixStacks, automation.all))).toBe("p1");
    expect(flop.slice(-3).map((event) => event.body.type)).toEqual([
      "holeDealt",
      "cardBurned",
      "boardDealt",
    ]);

    const noBoard = drive(start(oneStreet(0), sixStacks, automation.all));
    expect(dealable(noBoard)).toEqual([false, false, false]);
    expect(actor(noBoard.hand)).toBe("p1");
    expect(
      startedEvents(oneStreet(0), automation.all)
        .slice(-13)
        .map((event) => event.body.type)
    ).toEqual(["cardBurned", ...repeat("holeDealt" as const, 12)]);

    const game = holdem.noLimit({
      blinds: [0, 2],
      minBet: 2,
      anteTrimming: true,
    });
    const holdemTable = drive(start(game, sixStacks, automation.all));
    play(holdemTable, [fold, fold, fold, fold, call, call]);
    expect(dealable(holdemTable)).toEqual([false, false, false]);
    expect(actor(holdemTable.hand)).toBe("p1");
    expect(
      holdemTable
        .events()
        .slice(-2)
        .map((event) => event.body.type)
    ).toEqual(["cardBurned", "boardDealt"]);
  }
);

const manualDealing = allBut(
  "cardBurning",
  "holeDealing",
  "boardDealing",
  "runoutCountSelection"
);

unitTest(
  "pokerkit.tests.test_state.StateTestCase.test_dealing_action_queries",
  () => {
    const flop = drive(start(oneStreet(3), sixStacks, manualDealing));
    expect(dealable(flop)).toEqual([false, true, false]);
    expect(actor(flop.hand)).toBeNull();
    while (flop.can({ type: "dealHole" })) flop.act({ type: "dealHole" });
    expect(dealable(flop)).toEqual([true, false, false]);
    expect(actor(flop.hand)).toBeNull();
    flop.act({ type: "burnCard" });
    expect(dealable(flop)).toEqual([false, false, true]);
    expect(actor(flop.hand)).toBeNull();
    flop.act({ type: "dealBoard" });
    expect(dealable(flop)).toEqual([false, false, false]);
    expect(actor(flop.hand)).toBe("p1");

    const noBoard = drive(start(oneStreet(0), sixStacks, manualDealing));
    expect(dealable(noBoard)).toEqual([true, false, false]);
    expect(actor(noBoard.hand)).toBeNull();
    noBoard.act({ type: "burnCard" });
    expect(dealable(noBoard)).toEqual([false, true, false]);
    expect(actor(noBoard.hand)).toBeNull();
    while (noBoard.can({ type: "dealHole" })) noBoard.act({ type: "dealHole" });
    expect(dealable(noBoard)).toEqual([false, false, false]);
    expect(actor(noBoard.hand)).toBe("p1");

    const game = holdem.noLimit({
      blinds: [0, 2],
      minBet: 2,
      anteTrimming: true,
    });
    const table = drive(start(game, sixStacks, manualDealing));
    while (table.can({ type: "dealHole" })) table.act({ type: "dealHole" });
    play(table, [fold, fold, fold, fold, call, call]);
    expect(dealable(table)).toEqual([true, false, false]);
    expect(actor(table.hand)).toBeNull();
    table.act({ type: "burnCard" });
    expect(dealable(table)).toEqual([false, false, true]);
    expect(actor(table.hand)).toBeNull();
    table.act({ type: "dealBoard" });
    expect(dealable(table)).toEqual([false, false, false]);
    expect(actor(table.hand)).toBe("p1");
  }
);

/** pokerkit's turn_index, stand_patter_or_discarder_index, actor_index and showdown_index. */
function turns(hand: Hand) {
  const decision = auditor(hand).decision;
  const turn =
    decision.kind === "betting" ||
    decision.kind === "drawing" ||
    decision.kind === "showdown"
      ? decision.player
      : null;
  const when = (kind: Decision["kind"]) =>
    decision.kind === kind ? turn : null;
  return {
    turn,
    drawer: when("drawing"),
    actor: when("betting"),
    showdown: when("showdown"),
  };
}

unitTest("pokerkit.tests.test_state.StateTestCase.test_turn_index", () => {
  const game = draw.deuceToSevenSingle({
    blinds: [1, 2],
    minBet: 2,
    anteTrimming: true,
  });
  const table = drive(
    start(
      game,
      sixStacks,
      allBut("holeCardsShowingOrMucking", "runoutCountSelection")
    )
  );
  const acting = (player: PlayerId) => ({
    turn: player,
    drawer: null,
    actor: player,
    showdown: null,
  });
  for (const [player, move] of [
    ["p3", fold],
    ["p4", fold],
    ["p5", fold],
    ["p6", fold],
    ["p1", call],
    ["p2", call],
  ] as const) {
    expect(turns(table.hand)).toEqual(acting(player));
    move(table);
  }
  for (const player of ["p1", "p2"]) {
    expect(turns(table.hand)).toEqual({
      turn: player,
      drawer: player,
      actor: null,
      showdown: null,
    });
    standPat(table);
  }
  for (const player of ["p1", "p2"]) {
    expect(turns(table.hand)).toEqual(acting(player));
    call(table);
  }
  expect(turns(table.hand)).toEqual({
    turn: "p1",
    drawer: null,
    actor: null,
    showdown: "p1",
  });
  table.act({ type: "timeout" });
  expect(turns(table.hand)).toEqual({
    turn: "p2",
    drawer: null,
    actor: null,
    showdown: "p2",
  });
});

unitTest("pokerkit.tests.test_state.StateTestCase.test_reshuffling", () => {
  const table = drive(
    start(tripleDraw, sixStacks, allBut("runoutCountSelection"))
  );
  play(table, [
    ...sixCalls,
    ...everyoneDiscards,
    ...sixCalls,
    ...everyoneDiscards,
    ...sixCalls,
    ...everyoneDiscards,
    ...sixCalls,
  ]);
  expect(inProgress(table.hand)).toBe(false);
});

unitTest(
  "pokerkit.tests.test_state.StateTestCase.test_hole_to_board_dealing",
  () => {
    const razz = stud.razz({
      bringIn: 1,
      smallBet: 2,
      bigBet: 4,
      anteTrimming: true,
    });
    const table = drive(
      start(
        razz,
        repeat(200, 9),
        allBut("holeDealing", "boardDealing", "runoutCountSelection")
      )
    );
    const dealHoles = (count: number) =>
      repeat(accept({ type: "dealHole" }), count);
    play(table, [
      ...dealHoles(27),
      raise,
      ...repeat(call, 8),
      ...dealHoles(9),
      ...repeat(call, 9),
      ...dealHoles(9),
      ...repeat(call, 9),
    ]);
    for (const nextStreet of [4, null]) {
      expect(table.can({ type: "dealHole" })).toBe(false);
      expect(table.reject({ type: "dealHole" })).toEqual({
        code: "not_now",
        attempted: "dealHole",
        waitingFor: "dealer",
      });
      expect(table.can({ type: "dealBoard" })).toBe(true);
      table.act({ type: "dealBoard" });
      play(table, repeat(call, 9));
      expect(auditor(table.hand).street).toBe(nextStreet);
    }
  }
);

unitTest("pokerkit.tests.test_state.StateTestCase.test_preflop_opener", () => {
  const opener = (blinds: number[], players: number) => {
    const game = holdem.noLimit({ blinds, minBet: 2 });
    return actor(start(game, repeat(200, players), automation.all));
  };
  expect(opener([1, 2], 2)).toBe("p2");
  expect(opener([1, 2], 3)).toBe("p3");
  expect(opener([1, 2], 6)).toBe("p3");
  expect(opener([1, 2, 4], 6)).toBe("p4");
  expect(opener([1, 2, 4, 8], 6)).toBe("p5");
  expect(opener([1, 2, 0, 0, 0, 4], 6)).toBe("p1");
  expect(opener([1, 2, 4, 0, 0, 8], 6)).toBe("p1");

  const game = shortDeck.noLimit({
    antes: { kind: "everyone", amount: 1 },
    blinds: [0, 2],
    minBet: 2,
    anteTrimming: true,
  });
  expect(actor(start(game, [400, 400], allBut("runoutCountSelection")))).toBe(
    "p2"
  );
});

const tenPercent = {
  kind: "percentage",
  basisPoints: 1000,
  cap: null,
  noFlopNoDrop: false,
} as const;

unitTest("pokerkit.tests.test_state.StateTestCase.test_chips_pushing", () => {
  const raked = holdem.noLimit({
    blinds: [1, 2],
    minBet: 2,
    anteTrimming: true,
    rake: tenPercent,
  });
  const manualPushing = allBut(
    "cardBurning",
    "holeDealing",
    "boardDealing",
    "runoutCountSelection",
    "chipsPushing"
  );
  const push = accept({ type: "pushChips" });
  const royalBoard = runout("TsJsQs", "Ks", "As");
  const pushed = (
    game: Game,
    startingStacks: readonly number[],
    script: Move[]
  ) => {
    const table = drive(start(game, startingStacks, manualPushing));
    play(table, script);
    expect(inProgress(table.hand)).toBe(false);
    return stacks(table.hand);
  };
  expect(
    pushed(
      raked,
      [100, 10],
      [deal("2c3c"), deal("2d3d"), raiseTo(10), call, ...royalBoard, push]
    )
  ).toEqual([99, 9]);
  expect(
    pushed(
      raked,
      [100, 10, 1000],
      [
        deal("2c3c"),
        deal("2d3d"),
        deal("2h3h"),
        raiseTo(1000),
        call,
        call,
        ...royalBoard,
        push,
        push,
      ]
    )
  ).toEqual([90, 9, 990]);
  expect(
    pushed(
      raked,
      [100, 10, 10000, 1000],
      [
        deal("2c3c"),
        deal("2d3d"),
        deal("2h3h"),
        deal("2s3s"),
        raiseTo(10000),
        call,
        call,
        call,
        ...royalBoard,
        push,
        push,
        push,
      ]
    )
  ).toEqual([90, 9, 9900, 900]);
  expect(
    pushed(
      raked,
      [100, 10, 100000, 10000, 1000],
      [
        deal("2c3c"),
        deal("2d3d"),
        deal("2h3h"),
        deal("2s3s"),
        deal("4c5c"),
        raiseTo(100000),
        call,
        call,
        call,
        call,
        ...royalBoard,
        push,
        push,
        push,
        push,
      ]
    )
  ).toEqual([90, 9, 99000, 9000, 900]);
  const reraised = [
    deal("????"),
    deal("????"),
    raiseTo(6),
    raiseTo(18),
    raiseTo(54),
    fold,
    push,
  ];
  expect(pushed(raked, [100, 100], reraised)).toEqual([82, 116]);
  const noFlopNoDrop = holdem.noLimit({
    blinds: [1, 2],
    minBet: 2,
    anteTrimming: true,
    rake: { ...tenPercent, noFlopNoDrop: true },
  });
  expect(pushed(noFlopNoDrop, [100, 100], reraised)).toEqual([82, 118]);
});

unitTest(
  "pokerkit.tests.test_state.StateTestCase.test_unknown_showdown",
  () => {
    const game = holdem.noLimit({
      blinds: [1, 2],
      minBet: 2,
      anteTrimming: true,
    });
    const table = drive(
      start(
        game,
        [200, 200, 200],
        allBut(
          "cardBurning",
          "holeDealing",
          "boardDealing",
          "runoutCountSelection",
          "holeCardsShowingOrMucking"
        )
      )
    );
    const threeCalls = repeat(call, 3);
    play(table, [
      deal("????"),
      deal("????"),
      deal("????"),
      ...threeCalls,
      burn,
      board("TsJsQs"),
      ...threeCalls,
      burn,
      board("Ks"),
      ...threeCalls,
      burn,
      board("As"),
      ...threeCalls,
    ]);
    for (const player of ["p1", "p2", "p3"]) {
      expect(table.can({ type: "muck" })).toBe(true);
      expect(table.reject({ type: "show" })).toEqual({ code: "must_show" });
      for (const shown of ["????", "??2d"]) {
        expect(table.reject({ type: "show", cards: cards(shown) })).toEqual({
          code: "must_show",
        });
      }
      expect(table.can({ type: "show", cards: cards("TcJc") })).toBe(true);
      expect(table.act({ type: "muck" })).toEqual({ type: "mucked", player });
    }
    const view = auditor(table.hand);
    expect(view.decision.kind).toBe("complete");
    expect(view.pots).toEqual([{ amount: 6, raked: 0, eligible: [] }]);
    expect(potAmounts(table.hand)).toEqual([6]);
    expect(view.totalPot).toBe(6);
    expect(view.players.map((player) => player.startingStack)).toEqual(
      repeat(200, 3)
    );
    expect(stacks(table.hand)).toEqual(repeat(198, 3));
  }
);

unitTest("pokerkit.tests.test_state.StateTestCase.test_post_bets", () => {
  const game = (blinds: number[]) =>
    holdem.noLimit({ blinds, minBet: 2, anteTrimming: true });
  const opener = (blinds: number[]) =>
    actor(start(game(blinds), sixStacks, automation.all));
  expect(opener([1, 2])).toBe("p3");
  expect(opener([1, 2, -2])).toBe("p3");
  expect(opener([1, 2, 0, -2])).toBe("p3");
  expect(opener([1, 2, 0, 0, -2])).toBe("p3");
  expect(opener([1, 2, -2, 0, 0, -2])).toBe("p3");
  expect(opener([2, 2])).toBe("p3");
  expect(opener([1, 2, 4])).toBe("p4");
  expect(opener([1, 2, 4, -2, -2])).toBe("p4");

  const table = drive(
    start(game([1, 2, 0, 0, -2, -2]), sixStacks, automation.all)
  );
  expect(table.act(checkOrCall)).toEqual(called("p3", 2));
  expect(table.act(checkOrCall)).toEqual(called("p4", 2));
  expect(table.act(checkOrCall)).toEqual(checked("p5"));
  expect(table.act(checkOrCall)).toEqual(checked("p6"));
  expect(table.act(checkOrCall)).toEqual(called("p1", 1));
  expect(table.act(checkOrCall)).toEqual(checked("p2"));
  expect(table.act(checkOrCall)).toEqual(checked("p1"));
});

unitTest(
  "pokerkit.tests.test_state.StateTestCase.test_nonstandard_folds",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "everyone", amount: 125 },
      blinds: [250, 500],
      minBet: 125,
      mode: "cashGame",
    });
    const startingStacks = [2198, 945, 852, 3348, 1687, 1262, 3657, 3966];
    const table = drive(
      start(
        game,
        startingStacks,
        allBut(
          "cardBurning",
          "holeDealing",
          "boardDealing",
          "holeCardsShowingOrMucking"
        )
      )
    );
    const holes = [
      "9h5c",
      "KsQh",
      "7sQd",
      "2dKc",
      "8c6d",
      "Td9s",
      "8hQs",
      "9cKh",
    ];
    play(table, [
      ...holes.map(deal),
      raiseTo(645),
      call,
      raiseTo(1288),
      call,
      call,
      call,
      call,
      call,
      call,
      raiseTo(3178),
      call,
      fold,
      call,
      call,
      burn,
      board("2h6c4h"),
      fold,
      fold,
      show("9h5c"),
      show("KsQh"),
      show("7sQd"),
      show("8c6d"),
      show("Td9s"),
      burn,
      board("Th"),
      burn,
      board("5d"),
    ]);
    const total = (values: readonly Stack[]) =>
      values.reduce<number>(
        (sum, value) => sum + (value === "unbounded" ? 0 : value),
        0
      );
    expect(total(startingStacks) - total(stacks(table.hand))).toBe(2210);
  }
);

unitTest("pokerkit.tests.test_state.StateTestCase.test_folded_status", () => {
  const folded = (script: Move[]) => {
    const table = drive(
      start(rhodeIsland.fixedLimit(), [155, 155], automation.all)
    );
    play(table, script);
    const record = summarizeHand(table.hand);
    return record === null ? null : !record.wentToShowdown;
  };
  expect(folded([call, call, call, call, raise, raise, call])).toBe(false);
  expect(folded([raise, raise, fold])).toBe(true);
  expect(folded([call, call, call, call, raise, raise, fold])).toBe(true);
});

unitTest(
  "pokerkit.tests.test_state.StateTestCase.test_full_and_short_all_ins",
  () => {
    const game = holdem.noLimit({
      blinds: [1, 2],
      minBet: 2,
      anteTrimming: true,
      mode: "cashGame",
    });
    const automate = [
      "antePosting",
      "betCollection",
      "blindPosting",
      "cardBurning",
      "holeDealing",
      "boardDealing",
    ] as const;
    const shortAllIn = drive(start(game, [19, 200, 16, 200], automate));
    play(shortAllIn, [raiseTo(16), call, raiseTo(19), call]);
    expect(actor(shortAllIn.hand)).toBe("p4");
    expect(shortAllIn.can(minimumRaise(shortAllIn))).toBe(false);

    const table = drive(start(game, [19, 200, 200, 200], automate));
    play(table, [raiseTo(16), call, raiseTo(19), call]);
    expect(actor(table.hand)).toBe("p3");
    expect(table.can(minimumRaise(table))).toBe(false);
    call(table);
    expect(actor(table.hand)).toBe("p4");
    expect(table.can(minimumRaise(table))).toBe(false);
  }
);

unitTest("pokerkit.tests.test_state.StateTestCase.test_can_win_now", () => {
  const game = holdem.noLimit({
    antes: { kind: "everyone", amount: 1 },
    blinds: [1, 2],
    minBet: 2,
    anteTrimming: true,
    mode: "cashGame",
  });
  const table = drive(
    start(
      game,
      [76, 181, 300, 117, 5, 66, 27],
      [
        "antePosting",
        "betCollection",
        "blindPosting",
        "runoutCountSelection",
        "holeCardsShowingOrMucking",
      ]
    )
  );
  play(table, [
    deal("QhTs"),
    deal("8h2s"),
    deal("AsKh"),
    deal("4s6d"),
    deal("Ah6c"),
    deal("TcQd"),
    deal("4dQc"),
    raiseTo(114),
    raiseTo(116),
    fold,
    call,
    call,
    call,
    call,
    fold,
    ...runout("7c2hTd", "Kc", "Qs"),
  ]);
  expect(auditor(table.hand).players[6]?.canWinNow).toBe(false);
  expect(pending(table.hand, "handKilling")).toEqual(["p4", "p7"]);
  const kill = accept({ type: "killHand" });
  const push = accept({ type: "pushChips" });
  const pull = accept({ type: "pullChips" });
  play(table, [kill, kill, push, push, push, pull, pull, pull]);
  expect(inProgress(table.hand)).toBe(false);
  expect(
    summarizeHand(table.hand)?.players.map((player) => player.net)
  ).toEqual([143, 4, -115, -117, -1, 113, -27]);
});

/** pokerkit's `state.deck`: every card comes from this deck. */
function dealtFrom(game: Game, startingStacks: readonly number[]): Card[] {
  const view = auditor(start(game, startingStacks, automation.all));
  const dealt = view.players.flatMap((player) =>
    player.holeCards.map((hole) => hole.card)
  );
  return [...dealt, ...view.boards.flat(), ...(view.dealer?.deck ?? [])];
}

unitTest("pokerkit.tests.test_state.StateTestCase.test_leduc_holdem", () => {
  expect(dealtFrom(leduc.fixedLimit(), [13, 13]).sort()).toEqual(
    [...decks.leduc].sort()
  );
});

unitTest(
  "pokerkit.tests.test_state.StateTestCase.test_numeral211_holdem",
  () => {
    expect(dealtFrom(numeral211.fixedLimit(), [205, 205]).sort()).toEqual(
      [...decks.numeral211].sort()
    );
  }
);

function callAmount(hand: Hand): number | null {
  const decision = auditor(hand).decision;
  if (decision.kind !== "betting" || decision.checkOrCall === null) return null;
  return decision.checkOrCall.kind === "call" ? decision.checkOrCall.amount : 0;
}

unitTest("pokerkit.tests.test_state.StateTestCase.test_short_all_ins", () => {
  const game = holdem.noLimit({
    blinds: [1, 2],
    minBet: 2,
    anteTrimming: true,
  });
  const table = drive(start(game, [1002, 152, 1002, 202], automation.all));
  play(table, [call, call, call, call, raiseTo(100), raiseTo(150), call]);
  raiseTo(200)(table);
  expect(table.can({ type: "betOrRaiseTo", amount: 300 })).toBe(true);
  call(table);
  expect(actor(table.hand)).toBe("p3");
  expect(callAmount(table.hand)).toBe(50);
  expect(table.can({ type: "betOrRaiseTo", amount: 300 })).toBe(false);
});

unitTest("pokerkit.tests.test_state.StateTestCase.test_half_bet_all_in", () => {
  const game = holdem.fixedLimit({
    blinds: [5, 10],
    smallBet: 10,
    bigBet: 20,
    anteTrimming: true,
  });
  const halfBet = drive(start(game, [200, 25, 200, 200], automation.all));
  play(halfBet, [call, call, call, call, raiseTo(10), raiseTo(15), call, call]);
  expect(actor(halfBet.hand)).toBe("p1");
  expect(callAmount(halfBet.hand)).toBe(5);
  expect(halfBet.can(minimumRaise(halfBet))).toBe(true);

  const lessThanHalf = drive(start(game, [200, 24, 200, 200], automation.all));
  play(lessThanHalf, [
    call,
    call,
    call,
    call,
    raiseTo(10),
    raiseTo(14),
    call,
    call,
  ]);
  expect(actor(lessThanHalf.hand)).toBe("p1");
  expect(callAmount(lessThanHalf.hand)).toBe(4);
  expect(lessThanHalf.can(minimumRaise(lessThanHalf))).toBe(false);
});
