import { describe, expect, test } from "bun:test";

import type { HandEvent } from "../src/events.ts";
import {
  automation,
  type HoleCard,
  type PlayerId,
  type Transition,
} from "../src/hand.ts";
import { draw, holdem, stud } from "../src/rules.ts";
import {
  eventsFor,
  viewHand,
  type Audience,
  type HandEventView,
  type HandView,
} from "../src/views.ts";
import {
  allBut,
  auditor,
  drive,
  play,
  moves,
  repeat,
  spectator,
  start,
} from "./driver.ts";
import { randomWalk, type Walk } from "./random-hands.ts";
import { cards } from "./support.ts";

const { call } = moves;

function holeCardsOf(view: HandView): string[][] {
  return view.players.map((player) =>
    player.holeCards.map((hole) => hole.card)
  );
}

const hidden = ["??", "??"];

describe("viewHand", () => {
  const game = holdem.noLimit({ blinds: [1, 2], minBet: 2 });
  const deck = cards("AsKs QhJh 2c3d 4c5d6h 7c 8d");

  test("shows players their own hole cards and nobody else's", () => {
    const hand = start(game, [100, 100, 100], automation.all, deck);
    const dealt = holeCardsOf(auditor(hand));
    expect(dealt).toEqual([
      ["As", "Jh"],
      ["Ks", "2c"],
      ["Qh", "3d"],
    ]);
    const forP2 = viewHand(hand, { kind: "player", player: "p2" });
    expect(holeCardsOf(forP2)).toEqual([hidden, ["Ks", "2c"], hidden]);
    expect(forP2.players.map((player) => player.canWinNow === null)).toEqual([
      true,
      false,
      true,
    ]);
    expect(holeCardsOf(spectator(hand))).toEqual([hidden, hidden, hidden]);
  });

  test("gives the dealer's deck, burned and mucked cards to auditors only", () => {
    const table = drive(start(game, [100, 100, 100], automation.all, deck));
    play(table, [moves.fold, call, call]);
    expect(auditor(table.hand).dealer).toEqual({
      deck: ["8d"],
      burned: ["4c"],
      mucked: ["Qh", "3d"],
    });
    expect(spectator(table.hand).dealer).toBeNull();
    expect(viewHand(table.hand, { kind: "player", player: "p1" }).dealer).toBe(
      null
    );
  });

  test("shows stud up cards to everyone", () => {
    const game = stud.fixedLimit({ bringIn: 1, smallBet: 2, bigBet: 4 });
    const hand = start(
      game,
      [100, 100],
      automation.all,
      cards("2c3c 4c5c 6c7c")
    );
    expect(holeCardsOf(spectator(hand))).toEqual([
      ["??", "??", "6c"],
      ["??", "??", "7c"],
    ]);
  });

  test("reveals shown hole cards to everyone and mucked ones to nobody", () => {
    const fullDeck = cards("AsKsQhJh 2c 3d4c5d 6h 7c 8d 9s");
    const table = drive(start(game, [100, 100], automation.dealer, fullDeck));
    play(table, repeat(call, 8));
    expect(spectator(table.hand).decision).toEqual({
      kind: "showdown",
      player: "p1",
    });
    table.act({ type: "show" });
    table.act({ type: "muck" });
    const shown = spectator(table.hand);
    expect(shown.players.map((player) => player.holeCards)).toEqual([
      [
        { card: "As", face: "up" },
        { card: "Qh", face: "up" },
      ],
      [],
    ]);
    expect(eventsFor(table.events(), { kind: "spectator" })[0]?.body).toEqual({
      type: "mucked",
      player: "p2",
    });
  });
});

describe("eventsFor", () => {
  const game = draw.deuceToSevenSingle({ blinds: [1, 2], minBet: 2 });
  const automate = allBut("cardBurning", "holeDealing");

  function drawnHand() {
    const table = drive(start(game, [100, 100], automate));
    const events: HandEvent[] = [];
    const record = (action: Parameters<typeof table.act>[0]) => {
      table.act(action);
      events.push(...table.events());
    };
    record({ type: "dealHole", cards: cards("2c3d4h5s7c") });
    record({ type: "dealHole", cards: cards("KcKdKhKsQc") });
    record({ type: "checkOrCall" });
    record({ type: "checkOrCall" });
    record({ type: "draw", discard: [] });
    record({ type: "draw", discard: cards("KcKd") });
    record({ type: "burnCard", card: "Ac" });
    record({ type: "dealHole", cards: cards("8c9c") });
    return events;
  }

  test("hides burned cards, other players' hole cards and discards, causes included", () => {
    const events = drawnHand();
    const forP1 = eventsFor(events, { kind: "player", player: "p1" });
    const bodies = forP1.map((event) => event.body);
    expect(bodies).toContainEqual({ type: "cardBurned", card: "??" });
    expect(bodies).toContainEqual({
      type: "drew",
      player: "p2",
      discarded: ["??", "??"],
    });
    expect(bodies).toContainEqual({
      type: "holeDealt",
      player: "p2",
      cards: repeat({ card: "??", face: "down" }, 2),
    });
    const causes = forP1.flatMap((event) =>
      event.cause.kind === "action" ? [event.cause.action] : []
    );
    expect(causes).toContainEqual({ type: "burnCard", card: "??" });
    expect(causes).toContainEqual({ type: "draw", discard: ["??", "??"] });
    expect(causes).toContainEqual({ type: "dealHole", cards: ["??", "??"] });
    expect(causes).toContainEqual({
      type: "dealHole",
      cards: cards("2c3d4h5s7c"),
    });
  });

  test("changes nothing an auditor may see", () => {
    const events = drawnHand();
    expect<readonly HandEvent[]>(
      eventsFor(events, { kind: "auditor" })
    ).toEqual(events);
  });
});

const knownCard = /"([2-9TJQKA][cdhs?])"/g;

function cardsIn(value: HandView | HandEventView | undefined): string[] {
  return [...JSON.stringify(value).matchAll(knownCard)].map(
    ([, card]) => card ?? ""
  );
}

function seesAll(audience: Audience, player: PlayerId): boolean {
  return audience.kind === "player" && audience.player === player;
}

/** Adds what this event lets the audience know. */
function learn(known: Set<string>, audience: Audience, event: HandEvent) {
  const { body } = event;
  switch (body.type) {
    case "holeDealt":
      for (const { card, face } of body.cards) {
        if (face === "up" || seesAll(audience, body.player)) known.add(card);
      }
      return;
    case "boardDealt":
    case "shown":
      for (const card of body.cards) known.add(card);
      return;
    default:
      return;
  }
}

function transitions(walk: Walk): Transition[] {
  return [
    walk.start,
    ...walk.steps.flatMap((step) =>
      step.result.ok ? [step.result.value] : []
    ),
  ];
}

describe("random hands", () => {
  const walks = Array.from({ length: 60 }, (_, offset) =>
    randomWalk(10_000 + offset)
  );

  test("show each audience only cards it may know, in views and events", () => {
    const leaks = walks.flatMap((walk) => {
      const audiences: Audience[] = [
        { kind: "spectator" },
        ...walk.spectated.players.map(({ player }) => ({
          kind: "player" as const,
          player,
        })),
      ];
      return audiences.flatMap((audience) => {
        const known = new Set<string>();
        const unknown = (card: string) => !known.has(card);
        return transitions(walk).flatMap(({ hand, events }) => [
          ...events.flatMap((event) => {
            learn(known, audience, event);
            const [redacted] = eventsFor([event], audience);
            return cardsIn(redacted)
              .filter(unknown)
              .map((card) => ({
                seed: walk.seed,
                audience,
                seq: event.seq,
                card,
              }));
          }),
          ...cardsIn(viewHand(hand, audience))
            .filter(unknown)
            .map((card) => ({ seed: walk.seed, audience, view: true, card })),
        ]);
      });
    });
    expect(leaks).toEqual([]);
  });

  test("show players all their own cards and everyone the face-up ones", () => {
    for (const walk of walks) {
      for (const { hand } of transitions(walk)) {
        const truth = auditor(hand).players.map((player) => player.holeCards);
        const faceUp = truth.map((held) =>
          held.map((hole): HoleCard =>
            hole.face === "up" ? hole : { card: "??", face: hole.face }
          )
        );
        expect(
          spectator(hand).players.map((player) => player.holeCards)
        ).toEqual(faceUp);
        for (const [position, player] of walk.spectated.players.entries()) {
          const view = viewHand(hand, {
            kind: "player",
            player: player.player,
          });
          expect(view.players[position]?.holeCards).toEqual(truth[position]);
        }
      }
    }
  });
});
