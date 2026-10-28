import { describe, expect, test } from "bun:test";

import { decks, type Card } from "../src/cards.ts";
import {
  act,
  automation,
  replayHand,
  startHand,
  summarizeHand,
  type Action,
  type HandSetup,
} from "../src/hand.ts";
import {
  draw,
  holdem,
  omaha,
  stud,
  type Game,
  type Street,
} from "../src/rules.ts";
import { viewHand } from "../src/views.ts";
import {
  accept,
  allBut,
  auditor,
  drive,
  holeCards,
  minimumRaise,
  moves,
  play,
  repeat,
  spectator,
  stacks,
  start,
  type Move,
} from "./driver.ts";
import { cards } from "./support.ts";

const { board, burn, call, deal, fold, raiseTo } = moves;

const noLimit = holdem.noLimit({ blinds: [1, 2], minBet: 2 });
const cashGame = holdem.noLimit({
  blinds: [1, 2],
  minBet: 2,
  mode: "cashGame",
});

function setup(game: Game, deck: readonly Card[] = decks.standard): HandSetup {
  return { game, stacks: [100, 100], deck, automate: automation.all };
}

describe("startHand", () => {
  test("refuses player lists that do not name each stack once", () => {
    expect(startHand({ ...setup(noLimit), players: ["a", "a"] })).toEqual({
      ok: false,
      error: { code: "duplicate_player", player: "a" },
    });
    expect(startHand({ ...setup(noLimit), players: ["a"] })).toEqual({
      ok: false,
      error: { code: "player_ids", ids: 1, stacks: 2 },
    });
  });

  test("names players by the ids given", () => {
    const started = startHand({ ...setup(noLimit), players: ["ann", "bo"] });
    if (!started.ok) throw new Error(started.error.code);
    expect(started.value.events.slice(0, 2).map((event) => event.body)).toEqual(
      [
        { type: "blindPosted", player: "ann", amount: 2 },
        { type: "blindPosted", player: "bo", amount: 1 },
      ]
    );
  });

  test("refuses a deck holding a card twice", () => {
    expect(startHand(setup(noLimit, cards("AsKsAs")))).toEqual({
      ok: false,
      error: { code: "duplicate_card", card: "As" },
    });
  });

  test("refuses streets that deal nothing or deal hole cards on a draw", () => {
    const [first] = noLimit.rules.streets;
    const empty = { ...first, hole: [] } satisfies Street;
    const withStreets = (streets: readonly [Street, Street]): Game => ({
      ...noLimit,
      rules: { ...noLimit.rules, streets },
    });
    expect(startHand(setup(withStreets([first, empty])))).toEqual({
      ok: false,
      error: { code: "street_deals_nothing", street: 1 },
    });
    const drawing = { ...first, draw: true } satisfies Street;
    expect(startHand(setup(withStreets([first, drawing])))).toEqual({
      ok: false,
      error: { code: "hole_cards_with_draw", street: 1 },
    });
  });

  test("keeps no reference to the game it was given", () => {
    const [first, ...rest] = noLimit.rules.streets;
    const preflop = { ...first };
    const game: Game = {
      ...noLimit,
      rules: { ...noLimit.rules, streets: [preflop, ...rest] },
    };
    const table = drive(start(game, [100, 100], automation.all));
    preflop.minCompletionBetOrRaise = 10;
    expect(minimumRaise(table)).toEqual({ type: "betOrRaiseTo", amount: 4 });
  });
});

describe("act", () => {
  test("names the action and what the hand waits for when it is not time", () => {
    const table = drive(start(noLimit, [100, 100], automation.all));
    expect(table.reject({ type: "dealHole" })).toEqual({
      code: "not_now",
      attempted: "dealHole",
      waitingFor: "betting",
    });
  });

  test("refuses a named player who may not act, or does not exist", () => {
    const table = drive(start(noLimit, [100, 100], automation.all));
    expect(table.reject({ type: "fold", player: "p1" })).toEqual({
      code: "not_eligible",
      player: "p1",
      eligible: ["p2"],
    });
    expect(table.reject({ type: "fold", player: "p9" })).toEqual({
      code: "unknown_player",
      player: "p9",
    });
    expect(table.act({ type: "fold", player: "p2" })).toEqual({
      type: "folded",
      player: "p2",
      needless: false,
    });
  });

  test("posts for the named player, and refuses one who already posted", () => {
    const game = holdem.noLimit({
      blinds: [1, 2],
      minBet: 2,
      antes: { kind: "everyone", amount: 1 },
    });
    const table = drive(start(game, [100, 100, 100], allBut("antePosting")));
    expect(table.act({ type: "postAnte", player: "p2" })).toEqual({
      type: "antePosted",
      player: "p2",
      amount: 1,
    });
    expect(table.reject({ type: "postAnte", player: "p2" })).toEqual({
      code: "not_eligible",
      player: "p2",
      eligible: ["p1", "p3"],
    });
  });

  test("bounds bets and raises, in whole chips", () => {
    const table = drive(start(noLimit, [100, 100], automation.all));
    expect(table.reject({ type: "betOrRaiseTo", amount: 3 })).toEqual({
      code: "below_minimum",
      attempted: 3,
      minimum: 4,
    });
    expect(table.reject({ type: "betOrRaiseTo", amount: 101 })).toEqual({
      code: "above_maximum",
      attempted: 101,
      maximum: 100,
    });
    for (const amount of [10.5, NaN]) {
      expect(table.reject({ type: "betOrRaiseTo", amount })).toEqual({
        code: "invalid_amount",
        attempted: amount,
      });
    }
  });

  test("does not reopen the raising to a player after a short all-in", () => {
    const table = drive(start(noLimit, [5, 100, 100], automation.all));
    play(table, [raiseTo(4), raiseTo(5), call]);
    expect(table.reject(minimumRaise(table))).toEqual({
      code: "action_not_reopened",
    });
  });

  test("reopens the raising after a minimum raise, despite a later short all-in", () => {
    const table = drive(start(noLimit, [100, 100, 7], automation.all));
    play(table, [call, call, call, raiseTo(2), raiseTo(4), raiseTo(5)]);
    expect(table.act(minimumRaise(table))).toEqual({
      type: "betOrRaised",
      player: "p1",
      kind: "raise",
      to: 7,
      allIn: false,
    });
  });

  test("waits for the bring-in before anything else", () => {
    const game = stud.fixedLimit({ bringIn: 1, smallBet: 2, bigBet: 4 });
    const table = drive(start(game, [100, 100], automation.all));
    expect(table.reject({ type: "fold" })).toEqual({
      code: "bring_in_pending",
    });
    expect(table.reject({ type: "checkOrCall" })).toEqual({
      code: "bring_in_pending",
    });
  });

  test("refuses a fold when checking is free, outside cash games", () => {
    const table = drive(start(noLimit, [100, 100], automation.all));
    call(table);
    expect(table.reject({ type: "fold" })).toEqual({ code: "needless_fold" });
    const cash = drive(start(cashGame, [100, 100], automation.all));
    call(cash);
    expect(cash.act({ type: "fold" })).toEqual({
      type: "folded",
      player: "p1",
      needless: true,
    });
  });

  test("refuses to deal more cards than are owed, or none", () => {
    const table = drive(
      start(noLimit, [100, 100], allBut("holeDealing", "boardDealing"))
    );
    for (const text of ["AsKsQs", ""]) {
      expect(table.reject({ type: "dealHole", cards: cards(text) })).toEqual({
        code: "wrong_card_count",
        expected: 2,
        attempted: text.length / 2,
      });
    }
    table.act({ type: "dealHole", cards: cards("AsKs") });
    table.act({ type: "dealHole", cards: cards("QsJs") });
    play(table, [call, call]);
    expect(
      table.reject({ type: "dealBoard", cards: cards("2c3c4c5c") })
    ).toEqual({ code: "wrong_card_count", expected: 3, attempted: 4 });
  });

  test("refuses to deal from a deck that ran out", () => {
    const deck = cards("AsKsQsJs");
    const table = drive(start(noLimit, [100, 100], automation.all, deck));
    play(table, [call, call]);
    expect(auditor(table.hand).decision).toEqual({
      kind: "dealer",
      step: "cardBurning",
    });
    expect(table.reject({ type: "burnCard" })).toEqual({
      code: "not_enough_cards",
      needed: 1,
      available: 0,
    });
  });

  test("refuses to discard a card the player does not hold", () => {
    const game = draw.deuceToSevenSingle({ blinds: [1, 2], minBet: 2 });
    const table = drive(start(game, [100, 100], automation.all));
    play(table, [call, call]);
    const held = auditor(table.hand).players[0]?.holeCards.map(
      (hole) => hole.card
    );
    const missing = decks.standard.find((card) => !held?.includes(card));
    if (missing === undefined) throw new Error("Every card is held");
    expect(table.reject({ type: "draw", discard: [missing] })).toEqual({
      code: "card_not_held",
      card: missing,
    });
  });

  test("refuses to show more cards than held, or cards nobody knows", () => {
    const table = drive(
      start(
        cashGame,
        [100, 100],
        allBut("holeDealing", "holeCardsShowingOrMucking")
      )
    );
    table.act({ type: "dealHole", cards: cards("????") });
    table.act({ type: "dealHole", cards: cards("AsKs") });
    play(table, repeat(call, 8));
    expect(table.reject({ type: "show", cards: cards("2c3c4c") })).toEqual({
      code: "wrong_card_count",
      expected: 2,
      attempted: 3,
    });
    expect(table.reject({ type: "show" })).toEqual({
      code: "unknown_card_shown",
    });
  });

  test("refuses a runout count below one, or above what the deck can deal", () => {
    const table = drive(
      start(cashGame, [100, 100], allBut("runoutCountSelection"))
    );
    play(table, [raiseTo(100), call]);
    for (const count of [0, 7]) {
      expect(table.reject({ type: "selectRunoutCount", count })).toEqual({
        code: "runout_count_out_of_range",
        attempted: count,
        maximum: 6,
      });
    }
  });

  test("needs a named player to show once the hand is over", () => {
    const table = drive(start(noLimit, [100, 100], automation.all));
    fold(table);
    expect(table.reject({ type: "show" })).toEqual({ code: "player_required" });
    const held = holeCards(auditor(table.hand), 0, "down");
    expect(table.act({ type: "show", player: "p1" })).toEqual({
      type: "shown",
      player: "p1",
      cards: held,
    });
  });

  test("stores commentary on the action's event only", () => {
    const hand = start(noLimit, [100, 100], automation.all);
    const result = act(hand, { type: "checkOrCall" }, { commentary: "limp" });
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.events.map((event) => event.commentary)).toEqual([
      "limp",
    ]);
  });

  test("keeps no reference to the arrays in an action", () => {
    const game = draw.deuceToSevenSingle({ blinds: [1, 2], minBet: 2 });
    const table = drive(start(game, [100, 100], automation.all));
    play(table, [call, call]);
    const discard = holeCards(auditor(table.hand), 0, "down");
    const held = [...discard];
    const result = act(table.hand, { type: "draw", discard });
    discard.length = 0;
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.events[0]?.body).toEqual({
      type: "drew",
      player: "p1",
      discarded: held,
    });
  });
});

describe("dividing chips", () => {
  test("gives a split pot's odd chip to the earliest position", () => {
    const table = drive(
      start(
        noLimit,
        [100, 100, 100],
        allBut("holeDealing", "boardDealing", "cardBurning")
      )
    );
    play(table, [deal("2c3c"), deal("2d3d"), deal("2h3h"), call, fold, call]);
    for (const dealt of ["AsKsQs", "Js", "Ts"]) {
      play(table, [burn, board(dealt), call, call]);
    }
    expect(stacks(table.hand)).toEqual([99, 101, 100]);
  });

  test("rounds the rake half to even, as Python's round does", () => {
    const game = holdem.noLimit({
      blinds: [1, 2],
      minBet: 2,
      mode: "cashGame",
      rake: {
        kind: "percentage",
        basisPoints: 1000,
        cap: null,
        noFlopNoDrop: false,
      },
    });
    const table = drive(start(game, [100, 100, 100], automation.all));
    play(table, [raiseTo(12), fold, call, ...repeat(call, 6)]);
    expect(summarizeHand(table.hand)?.rake).toBe(2);
  });

  test("gives a side pot to its high hand when nobody in it has a low", () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [1, 2],
      smallBet: 2,
      bigBet: 4,
    });
    const table = drive(
      start(
        game,
        [2, 4, 100, 100],
        allBut("holeDealing", "boardDealing", "cardBurning")
      )
    );
    play(table, [
      ...["As3d9c9h", "AhAdJcJd", "QhQdJhJs", "ThTd9d9s"].map(deal),
      ...repeat(call, 4),
      ...[burn, board("2c5d7h"), moves.raise, call, call],
      ...[burn, board("Kc"), moves.raise, call],
      ...[burn, board("Ks"), call, call],
    ]);
    expect(
      summarizeHand(table.hand)?.pots.map(({ winners }) => winners)
    ).toEqual([
      [
        { player: "p2", amount: 4, hand: "Two pair (AhAd7hKcKs)" },
        { player: "p1", amount: 4, hand: "High card (As3d2c5d7h)" },
      ],
      [{ player: "p2", amount: 6, hand: "Two pair (AhAd7hKcKs)" }],
      [{ player: "p3", amount: 8, hand: "Two pair (QhQd7hKcKs)" }],
    ]);
  });
});

describe("runouts", () => {
  test("split each pot between the boards, as in pokerkit's four-runout example", () => {
    const game = holdem.noLimit({
      blinds: [200, 400, 800],
      minBet: 400,
      mode: "cashGame",
      antes: { kind: "byPosition", amounts: [0, 0, 0, 0, 0, 600] },
    });
    const table = drive(
      start(
        game,
        ["unbounded", 116400, 86900, "unbounded", 50000, "unbounded"],
        allBut(
          "holeDealing",
          "boardDealing",
          "cardBurning",
          "runoutCountSelection"
        )
      )
    );
    play(table, [
      ...["JsTh", "Ah9d", "KsKc", "5c2h", "6h5h", "6s3s"].map(deal),
      ...[fold, raiseTo(2800), fold, call, raiseTo(12600), call, call, call],
      ...[burn, board("9hTs9s"), call, raiseTo(17000), raiseTo(36000)],
      ...[fold, fold, raiseTo(103800), call],
      accept({ type: "selectRunoutCount", count: 4 }),
      accept({ type: "selectRunoutCount", count: null }),
      ...["Jh", "Ad", "Kh", "3c", "7s", "8s", "Qc", "Kd"].flatMap((card) => [
        burn,
        board(card),
      ]),
    ]);
    expect(stacks(table.hand)).toEqual([
      "unbounded",
      79400,
      149700,
      "unbounded",
      37400,
      "unbounded",
    ]);
  });

  test("go as far as the deck can deal every street, burns included", () => {
    const table = drive(
      start(cashGame, [100, 100], allBut("runoutCountSelection"))
    );
    play(table, [raiseTo(100), call]);
    expect(auditor(table.hand).decision).toEqual({
      kind: "runoutSelection",
      players: ["p1", "p2"],
      maxRunouts: 6,
    });
    play(table, repeat(accept({ type: "selectRunoutCount", count: 6 }), 2));
    const record = summarizeHand(table.hand);
    expect(record?.runouts).toBe(6);
    expect(new Set(record?.boards.flat()).size).toBe(30);
    expect(record?.unclaimed).toBe(0);
  });
});

describe("reshuffling", () => {
  test("deals burned and discarded cards again in a seeded order", () => {
    const game = draw.deuceToSevenTriple({
      blinds: [1, 2],
      smallBet: 2,
      bigBet: 4,
    });
    const deck = decks.standard;
    let hand = start(game, repeat(200, 6), automation.all, deck);
    const actions: Action[] = [];
    for (;;) {
      const view = auditor(hand);
      const { decision } = view;
      if (decision.kind === "complete") break;
      const drawer = decision.kind === "drawing" ? decision.player : null;
      const held =
        view.players.find(({ player }) => player === drawer)?.holeCards ?? [];
      const action: Action =
        drawer === null
          ? { type: "checkOrCall" }
          : { type: "draw", discard: held.map(({ card }) => card) };
      const result = act(hand, action);
      if (!result.ok) throw new Error(result.error.code);
      hand = result.value.hand;
      actions.push(action);
    }
    const replayed = replayHand(
      { game, stacks: repeat(200, 6), deck, automate: automation.all },
      actions
    );
    if (!replayed.ok) throw new Error(replayed.error.code);
    expect(auditor(replayed.value.hand)).toEqual(auditor(hand));

    const bodies = replayed.value.events.map(({ body }) => body);
    const dealt = bodies.flatMap((body) => {
      if (body.type === "cardBurned") return [body.card];
      return body.type === "holeDealt"
        ? body.cards.map(({ card }) => card)
        : [];
    });
    const firstBurn = bodies.find((body) => body.type === "cardBurned");
    const firstDiscards = bodies
      .flatMap((body) => (body.type === "drew" ? [body.discarded] : []))
      .slice(0, 6)
      .flat();
    const reserve = [
      firstBurn?.type === "cardBurned" ? firstBurn.card : null,
      ...firstDiscards,
    ];
    const redealt = dealt.slice(deck.length, deck.length + 9);
    expect(reserve).toEqual(expect.arrayContaining(redealt));
    expect(redealt).not.toEqual(reserve.slice(0, 9));
  });
});

describe("unbounded stacks", () => {
  test("never run out, and leave the net unknown", () => {
    const deck = cards("2cAc7dAd 3h 9sTsJh 4h 5c 6h Kd");
    const table = drive(
      start(noLimit, ["unbounded", 100], automation.all, deck)
    );
    play(table, [raiseTo(100), call]);
    const record = summarizeHand(table.hand);
    expect(
      record?.players.map(({ endingStack, net }) => [endingStack, net])
    ).toEqual([
      ["unbounded", null],
      [200, 100],
    ]);
  });
});

describe("summarizeHand", () => {
  test("names a winning hand once shown, even after the losers' hands are killed", () => {
    const deck = cards("2cAc7dAd 3h 9sTsJh 4h 5c 6h Kd");
    const winners = (moves: readonly Move[]) => {
      const table = drive(start(noLimit, [100, 100], automation.all, deck));
      play(table, moves);
      return summarizeHand(table.hand)?.pots.flatMap((pot) => pot.winners);
    };
    expect(winners([raiseTo(100), call])).toEqual([
      { player: "p2", amount: 200, hand: "One pair (AcAdTsJhKd)" },
    ]);
    expect(winners([fold])).toEqual([{ player: "p1", amount: 1, hand: null }]);
  });
});

describe("replayHand", () => {
  const actions: Action[] = [{ type: "checkOrCall" }, { type: "fold" }];

  test("names the setup error or the first refused action", () => {
    expect(replayHand({ ...setup(noLimit), stacks: [100] }, actions)).toEqual({
      ok: false,
      error: { code: "setup", error: { code: "player_count", players: 1 } },
    });
    expect(replayHand(setup(noLimit), actions)).toEqual({
      ok: false,
      error: {
        code: "rejected",
        index: 1,
        violation: { code: "needless_fold" },
      },
    });
  });

  test("returns every event since the start", () => {
    const replayed = replayHand(setup(noLimit), [{ type: "fold" }]);
    if (!replayed.ok) throw new Error(replayed.error.code);
    const { hand, events } = replayed.value;
    expect(events.map((event) => event.seq)).toEqual(
      events.map((_, index) => index + 1)
    );
    expect(events.at(-1)?.seq).toBe(spectator(hand).version);
    expect(viewHand(hand, { kind: "auditor" }).decision.kind).toBe("complete");
  });
});
