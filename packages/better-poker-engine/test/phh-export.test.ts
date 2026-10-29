import { describe, expect, test } from "bun:test";

import type { Card } from "../src/cards.ts";
import { act, type Action, type Hand } from "../src/hand.ts";
import {
  formatPhh,
  historyFromHand,
  parsePhh,
  replayHistory,
  type Phh,
} from "../src/phh.ts";
import { err, ok } from "../src/result.ts";
import { holdem, stud } from "../src/rules.ts";
import {
  accept,
  allBut,
  drive,
  moves,
  play,
  start,
  type Move,
} from "./driver.ts";

const { burn, board, call, fold, raiseTo } = moves;

const manualDealing = allBut(
  "cardBurning",
  "holeDealing",
  "boardDealing",
  "holeCardsShowingOrMucking",
  "runoutCountSelection"
);

const cashGame = holdem.noLimit({
  blinds: [1, 2],
  minBet: 2,
  mode: "cashGame",
});

function dealTo(player: string, card: Card): Move {
  return accept({ type: "dealHole", player, cards: [card] });
}

function exported(hand: Hand): Phh {
  const history = historyFromHand(hand);
  if (!history.ok) throw new Error(JSON.stringify(history.error));
  return history.value;
}

function commented(hand: Hand, action: Action, commentary?: string): Hand {
  const next =
    commentary === undefined
      ? act(hand, action)
      : act(hand, action, { commentary });
  if (!next.ok) throw new Error(JSON.stringify(next.error));
  return next.value.hand;
}

describe("historyFromHand", () => {
  test("writes a played hand the way pokerkit's from_game_state does", () => {
    const table = drive(start(cashGame, [200, 200, 200], manualDealing));
    play(table, [
      dealTo("p2", "Kd"),
      dealTo("p3", "Qh"),
      dealTo("p1", "Ac"),
      dealTo("p2", "Kc"),
      dealTo("p3", "Qs"),
      dealTo("p1", "Ad"),
      raiseTo(6),
      fold,
      call,
      burn,
      board("Td9c8h"),
      call,
      raiseTo(10),
      call,
      burn,
      board("5d"),
      call,
      call,
      burn,
      board("2s"),
      call,
      call,
      accept({ type: "show", player: "p2" }),
      accept({ type: "muck", player: "p3" }),
    ]);
    expect(formatPhh(exported(table.hand))).toBe(
      [
        "variant = 'NT'",
        "ante_trimming_status = false",
        "antes = [0, 0, 0]",
        "blinds_or_straddles = [1, 2, 0]",
        "min_bet = 2",
        "starting_stacks = [200, 200, 200]",
        `actions = [${[
          "d dh p1 AcAd",
          "d dh p2 KdKc",
          "d dh p3 QhQs",
          "p3 cbr 6",
          "p1 f",
          "p2 cc",
          "d db Td9c8h",
          "p2 cc",
          "p3 cbr 10",
          "p2 cc",
          "d db 5d",
          "p2 cc",
          "p3 cc",
          "d db 2s",
          "p2 cc",
          "p3 cc",
          "p2 sm KdKc",
          "p3 sm",
        ]
          .map((action) => `'${action}'`)
          .join(", ")}]`,
      ].join("\n")
    );
  });

  test("writes amounts at amountScale, a post bet as a negative blind", () => {
    const game = holdem.noLimit({
      blinds: [10, 25, -25],
      minBet: 25,
      antes: { kind: "everyone", amount: 5 },
    });
    const table = drive(start(game, [1000, 1000, 1000], manualDealing));
    play(table, [
      accept({ type: "dealHole", player: "p1", cards: ["Ac", "Ad"] }),
      accept({ type: "dealHole", player: "p2", cards: ["Kc", "Kd"] }),
      accept({ type: "dealHole", player: "p3", cards: ["Qc", "Qd"] }),
      raiseTo(75),
    ]);
    const history = historyFromHand(table.hand, { amountScale: 100 });
    expect(history).toMatchObject(
      ok({
        antes: ["0.05", "0.05", "0.05"],
        blinds: ["0.1", "0.25", "-0.25"],
        minBet: "0.25",
        startingStacks: ["10", "10", "10"],
      })
    );
    expect(history.ok && history.value.actions.at(-1)).toEqual({
      type: "betOrRaiseTo",
      player: 3,
      amount: "0.75",
      commentary: null,
    });
  });

  test("keeps commentary with the event it was given for", () => {
    const manualBlinds = allBut(
      "blindPosting",
      "cardBurning",
      "holeDealing",
      "boardDealing",
      "holeCardsShowingOrMucking",
      "runoutCountSelection"
    );
    let hand = start(cashGame, [200, 200], manualBlinds);
    hand = commented(hand, { type: "postBlind" }, "late");
    hand = commented(hand, { type: "postBlind" });
    hand = commented(
      hand,
      { type: "dealHole", player: "p1", cards: ["Ac", "Ad"] },
      "dealt"
    );
    hand = commented(hand, {
      type: "dealHole",
      player: "p2",
      cards: ["Kc", "Kd"],
    });
    hand = commented(hand, { type: "fold" }, "tilt");
    const history = exported(hand);
    expect(formatPhh(history).split("\n").at(-1)).toBe(
      "actions = ['# late', 'd dh p1 AcAd # dealt', 'd dh p2 KcKd', 'p2 f # tilt']"
    );
    const parsed = parsePhh(formatPhh(history));
    const replay = parsed.ok ? replayHistory(parsed.value) : parsed;
    if (!replay.ok) throw new Error(JSON.stringify(replay.error));
    expect(
      replay.value.steps.flatMap((step) =>
        step.events.flatMap((event) =>
          event.commentary === null ? [] : [[event.body.type, event.commentary]]
        )
      )
    ).toEqual([
      ["holeDealt", "dealt"],
      ["folded", "tilt"],
    ]);
  });

  test("writes the hand's ante trimming, which pokerkit leaves false", () => {
    const trimmed = holdem.noLimit({
      blinds: [1, 2],
      minBet: 2,
      antes: { kind: "everyone", amount: 1 },
      anteTrimming: true,
    });
    expect(
      exported(start(trimmed, [200, 200], manualDealing)).anteTrimming
    ).toBe(true);
  });

  test("refuses games PHH has no variant code or bring-in for", () => {
    const custom = { ...cashGame, variant: "custom" } as const;
    expect(historyFromHand(start(custom, [200, 200], manualDealing))).toEqual(
      err({ code: "custom_variant" })
    );
    const noBringIn = stud.fixedLimit({
      smallBet: 2,
      bigBet: 4,
      antes: { kind: "everyone", amount: 1 },
    });
    expect(historyFromHand(start(noBringIn, [20, 20], manualDealing))).toEqual(
      err({ code: "no_bring_in" })
    );
  });
});
