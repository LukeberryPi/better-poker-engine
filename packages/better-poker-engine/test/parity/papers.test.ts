import { expect } from "bun:test";

import { unitTest } from "../../../../parity/harness.ts";
import { decks } from "../../src/cards.ts";
import type { Stack } from "../../src/chips.ts";
import { compareHands, evaluate, handValue } from "../../src/evaluation.ts";
import {
  startHand,
  summarizeHand,
  type Automation,
  type Hand,
} from "../../src/hand.ts";
import { formatPhhAction } from "../../src/phh-actions.ts";
import {
  formatPhh,
  type AmountScale,
  type HistoryReplay,
} from "../../src/phh.ts";
import { draw, holdem, omaha, shortDeck, type Game } from "../../src/rules.ts";
import {
  accept,
  allBut,
  drive,
  inProgress,
  moves,
  play,
  repeat,
  stacks,
  start,
  type Move,
} from "../driver.ts";
import { parsed, replayed } from "../phh-support.ts";
import { cards, known } from "../support.ts";

const {
  deal,
  board,
  burn,
  call,
  fold,
  raise,
  raiseTo,
  standPat,
  discard,
  show,
} = moves;

function selectRunoutCount(count: number | null): Move {
  return accept({ type: "selectRunoutCount", count });
}

/** pokerkit's `state.operations`, which do not say what caused them. */
function operationsOf(replay: HistoryReplay) {
  return replay.steps.flatMap((step) =>
    step.events.map(({ body, commentary }) => ({ body, commentary }))
  );
}

function withoutRunoutCounts(operations: ReturnType<typeof operationsOf>) {
  return operations.filter(({ body }) => body.type !== "runoutCountSelected");
}

/** Kim2024TestCase's checks. `finalStacks` are pokerkit's numbers, which the
 * replay counts in chips of 1 / `amountScale`. */
function kim2024(
  text: string,
  finalStacks: Stack[],
  amountScale: AmountScale = 1
): void {
  const amounts = (hand: Hand) =>
    stacks(hand).map((stack) =>
      stack === "unbounded" ? stack : stack / amountScale
    );
  let hh = parsed(text);
  const replay = replayed(hh, { amountScale });
  const states = replay.steps.map((step) => step.hand);
  const state = replay.final;

  expect(states.findIndex((hand) => !inProgress(hand))).toBe(states.length - 1);
  expect(amounts(state)).toEqual(finalStacks);

  const s = formatPhh(hh);
  hh = parsed(s);
  let newReplay = replayed(hh, { amountScale });

  expect(newReplay.steps.map((step) => step.action)).toEqual([
    null,
    ...hh.actions.map(formatPhhAction),
  ]);
  expect(amounts(newReplay.final)).toEqual(finalStacks);
  expect(operationsOf(newReplay)).toEqual(operationsOf(replay));
  expect(formatPhh(hh)).toBe(s);

  hh = parsed(s);
  newReplay = replayed(hh, { amountScale, automate: [] });

  expect(newReplay.steps.length).toBe(operationsOf(newReplay).length + 1);
  expect(
    newReplay.steps.flatMap((step) =>
      step.action === null ? [] : [step.action]
    )
  ).toEqual(hh.actions.map(formatPhhAction));
  expect(amounts(newReplay.final)).toEqual(finalStacks);
  expect(withoutRunoutCounts(operationsOf(newReplay))).toEqual(
    withoutRunoutCounts(operationsOf(replay))
  );
  expect(formatPhh(hh)).toBe(s);
}

unitTest("pokerkit.tests.test_papers.Kim2023TestCase.test_figure_1", () => {
  const kuhnPoker: Game = {
    variant: "custom",
    rules: {
      deck: "kuhn",
      handTypes: ["kuhn"],
      streets: [
        {
          burn: false,
          hole: ["down"],
          board: 0,
          draw: false,
          opening: "position",
          minCompletionBetOrRaise: 1,
          maxBetsAndRaises: null,
        },
      ],
      structure: "fixedLimit",
    },
    forcedBets: {
      antes: { kind: "byPosition", amounts: repeat(1, 2) },
      blinds: repeat(0, 2),
      bringIn: null,
      anteTrimming: true,
    },
    rake: { kind: "none" },
    mode: "tournament",
    boards: 1,
  };
  const state = startHand({
    game: kuhnPoker,
    stacks: repeat(2, 2),
    deck: decks.kuhn,
    automate: allBut("runoutCountSelection"),
  });

  expect(state.ok).toBe(true);
});

unitTest("pokerkit.tests.test_papers.Kim2023TestCase.test_figure_2", () => {
  const game = holdem.noLimit({
    antes: { kind: "everyone", amount: 500 },
    blinds: [1000, 2000],
    minBet: 2000,
    anteTrimming: true,
  });
  const automate = allBut(
    "holeDealing",
    "boardDealing",
    "runoutCountSelection"
  );
  const state = drive(start(game, [1125600, 2000000, 553500], automate));
  play(state, [
    deal("Ac2d"),
    deal("5h7s"),
    deal("7h6h"),
    raiseTo(7000),
    raiseTo(23000),
    fold,
    call,
    board("Jc3d5c"),
    raiseTo(35000),
    call,
    board("4h"),
    raiseTo(90000),
    raiseTo(232600),
    raiseTo(1067100),
    call,
    board("Jh"),
  ]);

  expect(stacks(state.hand)).toEqual([572100, 1997500, 1109500]);
});

unitTest("pokerkit.tests.test_papers.Kim2023TestCase.test_figure_3", () => {
  const h0 = evaluate("omahaHigh", cards("6c7c8c9c"), cards("8s9sTc"));
  const h1 = handValue("omahaHigh", known("6c7c8s9sTc"));
  if (h0 === null || h1 === null) throw new Error("Both are Omaha hands");

  expect(compareHands(h0, h1)).toBe(0);
});

unitTest(
  "pokerkit.tests.test_papers.Kim2024TestCase.test_dwan_ivey_2009",
  () => {
    kim2024(
      `# The first televised million dollar pot between Tom Dwan and Phil
# Ivey.
# Link: https://youtu.be/GnxFohpljqM

variant = "NT"
ante_trimming_status = true
antes = [500, 500, 500]
blinds_or_straddles = [1000, 2000, 0]
min_bet = 2000
starting_stacks = [1125600, 2000000, 553500]
actions = [
  # Pre-flop

  "d dh p1 Ac2d",  # Ivey
  "d dh p2 ????",  # Antonius
  "d dh p3 7h6h",  # Dwan

  "p3 cbr 7000",  # Dwan
  "p1 cbr 23000",  # Ivey
  "p2 f",  # Antonius
  "p3 cc",  # Dwan

  # Flop

  "d db Jc3d5c",

  "p1 cbr 35000",  # Ivey
  "p3 cc",  # Dwan

  # Turn

  "d db 4h",

  "p1 cbr 90000",  # Ivey
  "p3 cbr 232600",  # Dwan
  "p1 cbr 1067100",  # Ivey
  "p3 cc",  # Dwan

  # Showdown

  "p1 sm Ac2d",  # Ivey
  "p3 sm 7h6h",  # Dwan

  # River

  "d db Jh",
]
author = "Juho Kim"
event = "Full Tilt Million Dollar Cash Game S4E12"
year = 2009
players = ["Phil Ivey", "Patrik Antonius", "Tom Dwan"]
currency = "USD"
`,
      [572100, 1997500, 1109500]
    );
  }
);

unitTest(
  "pokerkit.tests.test_papers.Kim2024TestCase.test_phua_xuan_2019",
  () => {
    kim2024(
      `# An all-in hand between Xuan and Phua.
# Link: https://youtu.be/QlgCcphLjaQ

variant = "NS"
ante_trimming_status = true
antes = [3000, 3000, 3000, 3000, 3000, 3000]
blinds_or_straddles = [0, 0, 0, 0, 0, 3000]
min_bet = 3000
starting_stacks = [495000, 232000, 362000, 403000, 301000, 204000]
actions = [
  # Pre-flop

  "d dh p1 Th8h",  # Badziakouski
  "d dh p2 QsJd",  # Zhong
  "d dh p3 QhQd",  # Xuan
  "d dh p4 8d7c",  # Jun
  "d dh p5 KhKs",  # Phua
  "d dh p6 8c7h",  # Koon

  "p1 cc",  # Badziakouski
  "p2 cc",  # Zhong
  "p3 cbr 35000",  # Xuan
  "p4 f",  # Jun
  "p5 cbr 298000",  # Phua
  "p6 f",  # Koon
  "p1 f",  # Badziakouski
  "p2 f",  # Zhong
  "p3 cc",  # Xuan

  # Showdown

  "p5 sm KhKs",  # Phua
  "p3 sm QhQd",  # Xuan

  # Flop

  "d db 9h6cKc",

  # Turn

  "d db Jh",

  # River

  "d db Ts",
]
author = "Juho Kim"
event = "Triton London 2019"
address = "5 Hamilton Pl"
city = "London"
region = "Greater London"
postal_code = "W1J 7ED"
country = "United Kingdom"
year = 2019
players = [
  "Mikita Badziakouski",
  "Liu Ming Zhong",
  "Tan Xuan",
  "Wang Jun",
  "Paul Phua",
  "Jason Koon",
]
currency = "GBP"
`,
      [489000, 226000, 684000, 400000, 0, 198000]
    );
  }
);

unitTest(
  "pokerkit.tests.test_papers.Kim2024TestCase.test_antonius_blom_2009",
  () => {
    kim2024(
      `# The largest online poker pot every played between Patrik Antonius
# and Viktor Blom.
# Link: https://youtu.be/UMBm66Id2AA

variant = "PO"
ante_trimming_status = true
antes = [0, 0]
blinds_or_straddles = [500, 1000]
min_bet = 1000
starting_stacks = [1259450.25, 678473.5]
actions = [
  # Pre-flop

  "d dh p1 Ah3sKsKh",  # Antonius
  "d dh p2 6d9s7d8h",  # Blom

  "p2 cbr 3000",  # Blom
  "p1 cbr 9000",  # Antonius
  "p2 cbr 27000",  # Blom
  "p1 cbr 81000",  # Antonius
  "p2 cc",  # Blom

  # Flop

  "d db 4s5c2h",

  "p1 cbr 91000",  # Antonius
  "p2 cbr 435000",  # Blom
  "p1 cbr 779000",  # Antonius
  "p2 cc",  # Blom

  # Showdown

  "p1 sm Ah3sKsKh",  # Antonius
  "p2 sm 6d9s7d8h",  # Blom

  # Turn

  "d db 5h",

  # River

  "d db 9c",
]
author = "Juho Kim"
month = 11
year = 2009
players = ["Patrik Antonius", "Victor Blom"]
currency = "USD"
`,
      [1937923.75, 0.0],
      100
    );
  }
);

unitTest(
  "pokerkit.tests.test_papers.Kim2024TestCase.test_arieh_yockey_2019",
  () => {
    for (const s of [
      `# A bad beat between Yockey and Arieh.
# Link: https://youtu.be/pChCqb2FNxY

variant = "F2L3D"
ante_trimming_status = true
antes = [0, 0, 0, 0]
blinds_or_straddles = [75000, 150000, 0, 0]
small_bet = 150000
big_bet = 300000
starting_stacks = [1180000, 4340000, 5910000, 10765000]
actions = [
  # Pre-draw

  "d dh p1 7h6c4c3d2c",  # Yockey
  "d dh p2 ??????????",  # Hui
  "d dh p3 ??????????",  # Esposito
  "d dh p4 AsQs6s5c3c",  # Arieh

  "p3 f",  # Esposito
  "p4 cbr 300000",  # Arieh
  "p1 cbr 450000",  # Yockey
  "p2 f",  # Hui
  "p4 cc",  # Arieh

  # First draw

  "p1 sd",  # Yockey
  "p4 sd AsQs",  # Arieh
  "d dh p4 2hQh",  # Arieh

  "p1 cbr 150000",  # Yockey
  "p4 cc",  # Arieh

  # Second draw

  "p1 sd",  # Yockey
  "p4 sd Qh",  # Arieh
  "d dh p4 4d",  # Arieh

  "p1 cbr 300000",  # Yockey
  "p4 cc",  # Arieh

  # Third draw

  "p1 sd",  # Yockey
  "p4 sd 6s",  # Arieh
  "d dh p4 7c",  # Arieh

  "p1 cbr 280000",  # Yockey
  "p4 cc",  # Arieh

  # Showdown

  "p1 sm 7h6c4c3d2c",  # Yockey
  "p4 sm 2h4d7c5c3c",  # Arieh
]
author = "Juho Kim"
event = """2019 World Series of Poker Event #58: $50,000 \\
Poker Players Championship | Day 5"""
city = "Las Vegas"
region = "Nevada"
country = "United States of America"
day = 28
month = 6
year = 2019
players = [
  "Bryce Yockey",
  "Phil Hui",
  "John Esposito",
  "Josh Arieh",
]
`,
      `
# A bad beat between Yockey and Arieh.
variant = "F2L3D"
antes = [0, 0, 0, 0]
blinds_or_straddles = [
75000, 150000, 0, 0,
]
small_bet = 150000
big_bet = 300000
starting_stacks = [
  1180000, 4340000, 5910000, 10765000,
]
actions = [
  "d dh p1 7h6c4c3d2c", # Yockey
  "d dh p2 ??????????", # Hui
  "d dh p3 ??????????", # Esposito
  "d dh p4 AsQs6s5c3c", # Arieh
  "p3 f", # Esposito
  "p4 cbr 300000", # Arieh
  "p1 cbr 450000", # Yockey
  "p2 f", # Hui
  "p4 cc", # Arieh
  "p1 sd", # First draw; Yockey
  "p4 sd AsQs", # Arieh
  "d dh p4 2hQh", # Arieh
  "p1 cbr 150000", # Yockey
  "p4 cc", # Arieh
  "p1 sd", # Second draw; Yockey
  "p4 sd Qh", # Arieh
  "d dh p4 4d", # Arieh
  "p1 cbr 300000", # Yockey
  "p4 cc", # Arieh
  "p1 sd", # Third draw; Yockey
  "p4 sd 6s", # Arieh
  "d dh p4 7c", # Arieh
  "p1 cbr 280000", # Yockey
  "p4 cc", # Arieh
  "p1 sm 7h6c4c3d2c", # Showdown; Yockey
  "p4 sm 2h4d7c5c3c", # Arieh
]
event = "2019 WSOP Event #58"
city = "Las Vegas"
region = "Nevada"
country = "United States of America"
day = 28
month = 6
year = 2019
players = [
  "Bryce Yockey", "Phil Hui",
  "John Esposito", "Josh Arieh",
]
`,
    ]) {
      kim2024(s, [0, 4190000, 5910000, 12095000]);
    }
  }
);

unitTest(
  "pokerkit.tests.test_papers.Kim2024TestCase.test_alice_carol_wikipedia",
  () => {
    kim2024(
      `# An example badugi hand from Wikipedia.
# Link: https://en.wikipedia.org/wiki/Badugi

variant = "FB"
ante_trimming_status = true
antes = [0, 0, 0, 0]
blinds_or_straddles = [1, 2, 0, 0]
small_bet = 2
big_bet = 4
starting_stacks = [200, 200, 200, 200]
actions = [
  # Pre-draw

  "d dh p1 ????????",  # Bob
  "d dh p2 ????????",  # Carol
  "d dh p3 ????????",  # Ted
  "d dh p4 ????????",  # Alice

  "p3 f",  # Ted
  "p4 cc",  # Alice
  "p1 cc",  # Bob
  "p2 cc",  # Carol

  # First draw

  "p1 sd ????",  # Bob
  "p2 sd ????",  # Carol
  "p4 sd ??",  # Alice
  "d dh p1 ????",  # Bob
  "d dh p2 ????",  # Carol
  "d dh p4 ??",  # Alice

  "p1 cc",  # Bob
  "p2 cbr 2",  # Carol
  "p4 cc",  # Alice
  "p1 cc",  # Bob

  # Second draw

  "p1 sd ??",  # Bob
  "p2 sd",  # Carol
  "p4 sd ??",  # Alice
  "d dh p1 ??",  # Bob
  "d dh p4 ??",  # Alice

  "p1 cc",  # Bob
  "p2 cbr 4",  # Carol
  "p4 cbr 8",  # Alice
  "p1 f",  # Bob
  "p2 cc",  # Bob

  # Third draw

  "p2 sd ??",  # Carol
  "p4 sd",  # Alice
  "d dh p2 ??",  # Carol

  "p2 cc",  # Carol
  "p4 cbr 4",  # Alice
  "p2 cc",  # Carol

  # Showdown

  "p4 sm 2s4c6d9h",  # Alice
  "p2 sm 3s5d7c8h",  # Carol
]
author = "Juho Kim"
players = ["Bob", "Carol", "Ted", "Alice"]
`,
      [196, 220, 200, 184]
    );
  }
);

const shownAutomatically = [
  "antePosting",
  "betCollection",
  "blindPosting",
  "holeCardsShowingOrMucking",
  "handKilling",
  "chipsPushing",
  "chipsPulling",
] as const satisfies Automation;

unitTest(
  "pokerkit.tests.test_papers.READMETestCase.test_hellmuth_wiggins",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 0, 0, 0, 0, 600] },
      blinds: [200, 400, 800],
      minBet: 400,
      mode: "cashGame",
    });
    const state = drive(
      start(
        game,
        ["unbounded", 116400, 86900, "unbounded", 50000, "unbounded"],
        shownAutomatically
      )
    );
    play(state, [
      deal("JsTh"),
      deal("Ah9d"),
      deal("KsKc"),
      deal("5c2h"),
      deal("6h5h"),
      deal("6s3s"),
      fold,
      raiseTo(2800),
      fold,
      call,
      raiseTo(12600),
      call,
      call,
      call,
      burn,
      board("9hTs9s"),
      call,
      raiseTo(17000),
      raiseTo(36000),
      fold,
      fold,
      raiseTo(103800),
      call,
      selectRunoutCount(4),
      selectRunoutCount(null),
      burn,
      board("Jh"),
      burn,
      board("Ad"),
      burn,
      board("Kh"),
      burn,
      board("3c"),
      burn,
      board("7s"),
      burn,
      board("8s"),
      burn,
      board("Qc"),
      burn,
      board("Kd"),
    ]);

    expect(stacks(state.hand)).toEqual([
      "unbounded",
      79400,
      149700,
      "unbounded",
      37400,
      "unbounded",
    ]);
  }
);

unitTest("pokerkit.tests.test_papers.READMETestCase.test_dwan_ivey", () => {
  const game = holdem.noLimit({
    antes: { kind: "everyone", amount: 500 },
    blinds: [1000, 2000],
    minBet: 2000,
    anteTrimming: true,
  });
  const state = drive(
    start(game, [1125600, "unbounded", 553500], shownAutomatically)
  );
  play(state, [
    deal("Ac2d"),
    deal("????"),
    deal("7h6h"),
    raiseTo(7000),
    raiseTo(23000),
    fold,
    call,
    burn,
    board("Jc3d5c"),
    raiseTo(35000),
    call,
    burn,
    board("4h"),
    raiseTo(90000),
    raiseTo(232600),
    raiseTo(1067100),
    call,
    burn,
    board("Jh"),
  ]);

  expect(stacks(state.hand)).toEqual([572100, "unbounded", 1109500]);
});

unitTest("pokerkit.tests.test_papers.READMETestCase.test_phua_xuan", () => {
  const game = shortDeck.noLimit({
    antes: { kind: "everyone", amount: 3000 },
    blinds: [0, 0, 0, 0, 0, 3000],
    minBet: 3000,
    anteTrimming: true,
  });
  const state = drive(
    start(
      game,
      [495000, 232000, 362000, 403000, 301000, 204000],
      shownAutomatically
    )
  );
  play(state, [
    deal("Th8h"),
    deal("QsJd"),
    deal("QhQd"),
    deal("8d7c"),
    deal("KhKs"),
    deal("8c7h"),
    call,
    call,
    raiseTo(35000),
    fold,
    raiseTo(298000),
    fold,
    fold,
    fold,
    call,
    burn,
    board("9h6cKc"),
    burn,
    board("Jh"),
    burn,
    board("Ts"),
  ]);

  expect(stacks(state.hand)).toEqual([
    489000, 226000, 684000, 400000, 0, 198000,
  ]);
});

unitTest("pokerkit.tests.test_papers.READMETestCase.test_antonius_blom", () => {
  const cents = 100;
  const game = omaha.potLimit({
    blinds: [500 * cents, 1000 * cents],
    minBet: 1000 * cents,
    anteTrimming: true,
  });
  const state = drive(
    start(game, [1259450.25 * cents, 678473.5 * cents], shownAutomatically)
  );
  play(state, [
    deal("Ah3sKsKh"),
    deal("6d9s7d8h"),
    raiseTo(3000 * cents),
    raiseTo(9000 * cents),
    raiseTo(27000 * cents),
    raiseTo(81000 * cents),
    call,
    burn,
    board("4s5c2h"),
    raiseTo(91000 * cents),
    raiseTo(435000 * cents),
    raiseTo(779000 * cents),
    call,
    burn,
    board("5h"),
    burn,
    board("9c"),
  ]);

  expect(stacks(state.hand)).toEqual([1937923.75 * cents, 0.0]);
});

unitTest("pokerkit.tests.test_papers.READMETestCase.test_yockey_arieh", () => {
  const game = draw.deuceToSevenTriple({
    blinds: [75000, 150000],
    smallBet: 150000,
    bigBet: 300000,
    anteTrimming: true,
  });
  const state = drive(
    start(game, [1180000, 4340000, 5910000, 10765000], shownAutomatically)
  );
  play(state, [
    deal("7h6c4c3d2c"),
    deal("??????????"),
    deal("??????????"),
    deal("AsQs6s5c3c"),
    fold,
    raise,
    raise,
    fold,
    call,
    standPat,
    discard("AsQs"),
    burn,
    deal("2hQh"),
    raise,
    call,
    standPat,
    discard("Qh"),
    burn,
    deal("4d"),
    raise,
    call,
    standPat,
    discard("6s"),
    burn,
    deal("7c"),
    raise,
    call,
  ]);

  expect(stacks(state.hand)).toEqual([0, 4190000, 5910000, 12095000]);
});

unitTest("pokerkit.tests.test_papers.READMETestCase.test_alice_carol", () => {
  const game = draw.badugi({
    blinds: [1, 2],
    smallBet: 2,
    bigBet: 4,
    anteTrimming: true,
  });
  const automate = [
    "antePosting",
    "betCollection",
    "blindPosting",
    "handKilling",
    "chipsPushing",
    "chipsPulling",
  ] as const satisfies Automation;
  const state = drive(start(game, repeat("unbounded", 4), automate));
  play(state, [
    deal("????????"),
    deal("????????"),
    deal("????????"),
    deal("????????"),
    fold,
    call,
    call,
    call,
    discard("????"),
    discard("????"),
    discard("??"),
    burn,
    deal("????"),
    deal("????"),
    deal("??"),
    call,
    raise,
    call,
    call,
    discard("??"),
    standPat,
    discard("??"),
    burn,
    deal("??"),
    deal("??"),
    call,
    raise,
    raise,
    fold,
    call,
    discard("??"),
    standPat,
    burn,
    deal("??"),
    call,
    raise,
    call,
    show("2s4c6d9h"),
    show("3s5d7c8h"),
  ]);

  expect(stacks(state.hand)).toEqual(repeat("unbounded", 4));
  expect(summarizeHand(state.hand)?.players.map(({ net }) => net)).toEqual([
    -4, 20, 0, -16,
  ]);
});
