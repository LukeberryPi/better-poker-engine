import { describe, expect, test } from "bun:test";

import { decks, shuffle, type Card } from "../src/cards.ts";
import type { PlayerAction, PlayerId } from "../src/hand.ts";
import { randomBelow, seededRandom, type RandomSource } from "../src/random.ts";
import { draw, holdem, stud, type Game } from "../src/rules.ts";
import { parseTable, serializeTable } from "../src/storage.ts";
import {
  actAtTable,
  createTable,
  summarizeSession,
  tableEventsFor,
  tableStateOf,
  viewTable,
  type Table,
  type TableCommand,
  type TableEvent,
  type TableEventBody,
  type TableEventView,
  type TableView,
  type TableViolation,
} from "../src/table.ts";
import type { Audience, HandView } from "../src/views.ts";
import { cards, okValue } from "./support.ts";

const auditor = { kind: "auditor" } as const;
const game = holdem.noLimit({
  blinds: [1, 2],
  minBet: 2,
  rake: { kind: "percentage", basisPoints: 500, cap: 3, noFlopNoDrop: true },
});

function emptyTable(seats = 6, played: Game = game): Table {
  return okValue(createTable({ game: played, seats }));
}

/** The game's whole deck, `front` first in dealing order. */
function deckStarting(front: string): Card[] {
  const first = cards(front);
  return [...first, ...decks.standard.filter((card) => !first.includes(card))];
}

type Run = { readonly table: Table; readonly events: TableEvent[] };

function run(table: Table, commands: readonly TableCommand[]): Run {
  const events: TableEvent[] = [];
  let current = table;
  for (const command of commands) {
    const next = actAtTable(current, command);
    if (!next.ok) throw new Error(JSON.stringify(next.error));
    current = next.value.table;
    events.push(...next.value.events);
  }
  return { table: current, events };
}

function refusal(table: Table, command: TableCommand): TableViolation {
  const result = actAtTable(table, command);
  if (result.ok) throw new Error(`Accepted ${JSON.stringify(command)}`);
  expect(result.error.attempt).toEqual(command);
  return result.error.violation;
}

type ActCommand = Extract<TableCommand, { type: "act" }>;

function actAs(
  table: Table,
  player: PlayerId,
  action: PlayerAction
): ActCommand {
  const { version } = viewTable(table, auditor);
  return { type: "act", player, expectedVersion: version, action };
}

function joinAll(
  seats: readonly (readonly [PlayerId, number, number])[]
): Table {
  return run(
    emptyTable(),
    seats.map(([player, seat, stack]) => ({
      type: "join",
      player,
      seat,
      stack,
    }))
  ).table;
}

function handBodies(events: readonly TableEvent[]) {
  return events.flatMap(({ body }) =>
    body.type === "handEvent" ? [body.event.body] : []
  );
}

function stacksOf(table: Table): (number | null)[] {
  return viewTable(table, auditor).seats.map((seat) => seat?.stack ?? null);
}

function startedSeats(events: readonly TableEvent[]): number[][] {
  return events.flatMap(({ body }) =>
    body.type === "handStarted" ? [[body.button, ...body.seats]] : []
  );
}

describe("a table", () => {
  const threeSeated = joinAll([
    ["a", 1, 100],
    ["b", 3, 100],
    ["c", 4, 100],
  ]);

  function foldRound(
    table: Table,
    deck = shuffle(decks.standard, seededRandom(1))
  ): Run {
    const started = run(table, [{ type: "startHand", deck }]);
    let { table: current } = started;
    const events = [...started.events];
    for (;;) {
      const hand = viewTable(current, auditor).hand;
      if (hand === null) return { table: current, events };
      if (hand.decision.kind !== "betting") throw new Error("Not betting");
      const next = run(current, [
        actAs(current, hand.decision.player, { type: "fold" }),
      ]);
      current = next.table;
      events.push(...next.events);
    }
  }

  test("seats the player after the button first and moves the button each hand", () => {
    let table = threeSeated;
    const events: TableEvent[] = [];
    for (let hand = 0; hand < 4; hand += 1) {
      const round = foldRound(table);
      table = round.table;
      events.push(...round.events);
    }
    expect(startedSeats(events)).toEqual([
      [1, 3, 4, 1],
      [3, 4, 1, 3],
      [4, 1, 3, 4],
      [1, 3, 4, 1],
    ]);
  });

  test("carries every stack into the next hand", () => {
    const { table, events } = foldRound(threeSeated);
    expect(
      handBodies(events).filter(({ type }) => type === "blindPosted")
    ).toEqual([
      { type: "blindPosted", player: "b", amount: 1 },
      { type: "blindPosted", player: "c", amount: 2 },
    ]);
    expect(stacksOf(table)).toEqual([null, 100, null, 99, 101, null]);
    const next = run(table, [
      { type: "startHand", deck: shuffle(decks.standard, seededRandom(2)) },
    ]);
    const hand = viewTable(next.table, auditor).hand;
    expect(hand?.players.map((player) => player.startingStack)).toEqual([
      101, 100, 99,
    ]);
  });

  test("puts the button on the small blind heads-up", () => {
    const { table } = foldRound(threeSeated);
    const twoLeft = run(table, [{ type: "leave", player: "b" }]).table;
    const { events } = run(twoLeft, [
      { type: "startHand", deck: shuffle(decks.standard, seededRandom(3)) },
    ]);
    expect(startedSeats(events)).toEqual([[4, 1, 4]]);
    const blinds = handBodies(events).flatMap((body) =>
      body.type === "blindPosted" ? [[body.player, body.amount]] : []
    );
    expect(Object.fromEntries(blinds)).toEqual({ c: 1, a: 2 });
  });

  test("deals around a busted player and lets them leave", () => {
    const headsUp = joinAll([
      ["a", 0, 150],
      ["c", 2, 100],
    ]);
    const deck = deckStarting("KdAsKcAh 2c7d8h9s 3c Jd 4h Qh");
    let { table } = run(headsUp, [{ type: "startHand", deck }]);
    for (const [player, action] of [
      ["a", { type: "checkOrCall" }],
      ["c", { type: "betOrRaiseTo", amount: 100 }],
      ["a", { type: "checkOrCall" }],
    ] as const) {
      table = run(table, [actAs(table, player, action)]).table;
    }
    expect(stacksOf(table)).toEqual([247, null, 0, null, null, null]);
    const start = { type: "startHand", deck } as const;
    expect(refusal(table, start)).toEqual({
      code: "not_enough_players",
      players: 1,
    });
    const joined = run(table, [
      { type: "join", player: "d", seat: 4, stack: 50 },
      start,
    ]);
    expect(startedSeats(joined.events)).toEqual([[4, 0, 4]]);
    expect(
      viewTable(joined.table, auditor).seats.map((seat) => seat?.inHand ?? null)
    ).toEqual([true, null, false, null, true, null]);
    expect(
      viewTable(
        run(joined.table, [{ type: "leave", player: "c" }]).table,
        auditor
      ).seats[2]
    ).toBeNull();
  });

  test("deals a player who joins mid-hand into the next hand only", () => {
    const started = run(threeSeated, [
      { type: "startHand", deck: shuffle(decks.standard, seededRandom(4)) },
      { type: "join", player: "d", seat: 5, stack: 80 },
    ]);
    expect(viewTable(started.table, auditor).hand?.players.length).toBe(3);
    expect(refusal(started.table, { type: "leave", player: "a" })).toEqual({
      code: "in_hand",
      player: "a",
    });
    const { table } = run(started.table, [{ type: "leave", player: "d" }]);
    expect(viewTable(table, auditor).seats[5]).toBeNull();
  });

  test("deals a player who sits out out of the next hand, with seat and stack kept", () => {
    const started = run(threeSeated, [
      { type: "startHand", deck: shuffle(decks.standard, seededRandom(6)) },
      { type: "sitOut", player: "a" },
    ]);
    expect(started.events.at(-1)?.body).toEqual({
      type: "satOut",
      player: "a",
      seat: 1,
    });
    expect(viewTable(started.table, auditor).seats[1]).toEqual({
      player: "a",
      stack: 100,
      inHand: true,
      sittingOut: true,
    });
    let table = started.table;
    while (viewTable(table, auditor).hand !== null) {
      const decision = viewTable(table, auditor).hand?.decision;
      if (decision?.kind !== "betting") throw new Error("Not betting");
      table = run(table, [
        actAs(table, decision.player, { type: "fold" }),
      ]).table;
    }
    const sittingOut = foldRound(table);
    expect(startedSeats(sittingOut.events)).toEqual([[3, 4, 3]]);
    expect(stacksOf(sittingOut.table)[1]).toBe(stacksOf(table)[1]);
    expect(refusal(sittingOut.table, { type: "sitOut", player: "a" })).toEqual({
      code: "already_sitting_out",
      player: "a",
    });
    expect(refusal(sittingOut.table, { type: "sitIn", player: "b" })).toEqual({
      code: "not_sitting_out",
      player: "b",
    });
    expect(refusal(sittingOut.table, { type: "sitOut", player: "z" })).toEqual({
      code: "not_seated",
      player: "z",
    });
    const back = foldRound(
      run(sittingOut.table, [{ type: "sitIn", player: "a" }]).table
    );
    expect(startedSeats(back.events)).toEqual([[4, 1, 3, 4]]);
  });

  test("needs two players sitting in to deal, and lets one sitting out leave", () => {
    const headsUp = joinAll([
      ["a", 0, 100],
      ["b", 1, 100],
    ]);
    const away = run(headsUp, [{ type: "sitOut", player: "b" }]).table;
    const start = {
      type: "startHand",
      deck: shuffle(decks.standard, seededRandom(7)),
    } as const;
    expect(refusal(away, start)).toEqual({
      code: "not_enough_players",
      players: 1,
    });
    const left = run(away, [{ type: "leave", player: "b" }]);
    expect(left.events.map(({ body }) => body)).toEqual([
      { type: "left", player: "b", seat: 1, stack: 100 },
    ]);
  });

  test("acts only as the authenticated player, whatever the action names", () => {
    const { table } = run(threeSeated, [
      { type: "startHand", deck: shuffle(decks.standard, seededRandom(5)) },
    ]);
    expect(
      refusal(table, actAs(table, "b", { type: "fold", player: "a" }))
    ).toMatchObject({ code: "not_eligible", player: "b" });
  });

  test("refuses a second click decided against the same version", () => {
    const { table } = run(threeSeated, [
      { type: "startHand", deck: shuffle(decks.standard, seededRandom(6)) },
    ]);
    const click = actAs(table, "a", { type: "checkOrCall" });
    const once = run(table, [click]).table;
    expect(refusal(once, click)).toEqual({
      code: "stale_version",
      expected: viewTable(table, auditor).version,
      current: viewTable(once, auditor).version,
    });
    expect(refusal(once, { ...click, player: "b" })).toMatchObject({
      code: "stale_version",
    });
  });

  test("refuses voluntary shows, mucks and runout picks (adrs.md 19)", () => {
    const { table } = run(threeSeated, [
      { type: "startHand", deck: shuffle(decks.standard, seededRandom(7)) },
    ]);
    const attempts = [
      { type: "show" },
      { type: "muck" },
      { type: "selectRunoutCount", count: 2 },
    ] as const;
    expect(
      attempts.map((action) => refusal(table, actAs(table, "a", action)))
    ).toEqual([
      { code: "not_at_tables", attempted: "show" },
      { code: "not_at_tables", attempted: "muck" },
      { code: "not_at_tables", attempted: "selectRunoutCount" },
    ]);
  });

  test("refuses bad joins and leaves", () => {
    const join = (player: PlayerId, seat: number, stack: number) =>
      refusal(threeSeated, { type: "join", player, seat, stack });
    expect([
      join("d", 6, 100),
      join("d", -1, 100),
      join("d", 1, 100),
      join("a", 0, 100),
      join("d", 0, 0),
      join("d", 0, 1.5),
      refusal(threeSeated, { type: "leave", player: "d" }),
    ]).toEqual([
      { code: "no_such_seat", seat: 6 },
      { code: "no_such_seat", seat: -1 },
      { code: "seat_taken", seat: 1, player: "a" },
      { code: "already_seated", player: "a", seat: 1 },
      { code: "invalid_buy_in", stack: 0 },
      { code: "invalid_buy_in", stack: 1.5 },
      { code: "not_seated", player: "d" },
    ]);
  });

  test("deals only the game's whole deck, one hand at a time", () => {
    const whole = shuffle(decks.standard, seededRandom(8));
    const doubled = whole.with(1, whole[0] ?? "As");
    const start = (deck: readonly Card[]) =>
      refusal(threeSeated, { type: "startHand", deck });
    expect([
      start(whole.slice(1)),
      start(doubled),
      start([...whole, "As"]),
    ]).toEqual([
      { code: "not_a_full_deck" },
      { code: "not_a_full_deck" },
      { code: "not_a_full_deck" },
    ]);
    const { table } = run(threeSeated, [{ type: "startHand", deck: whole }]);
    expect(refusal(table, { type: "startHand", deck: whole })).toEqual({
      code: "hand_running",
    });
    expect(
      refusal(threeSeated, actAs(threeSeated, "a", { type: "fold" }))
    ).toEqual({ code: "no_hand" });
  });

  test("keeps every leaver in the session record", () => {
    const { table } = foldRound(threeSeated);
    const left = run(table, [
      { type: "leave", player: "c" },
      { type: "join", player: "c", seat: 0, stack: 40 },
    ]).table;
    expect(summarizeSession(left)).toMatchObject({
      hands: 1,
      players: [
        {
          player: "a",
          boughtIn: 100,
          cashedOut: 0,
          stack: 100,
          net: 0,
          hands: 1,
        },
        {
          player: "b",
          boughtIn: 100,
          cashedOut: 0,
          stack: 99,
          net: -1,
          hands: 1,
        },
        {
          player: "c",
          boughtIn: 140,
          cashedOut: 101,
          stack: 40,
          net: 1,
          hands: 1,
        },
      ],
    });
  });

  test("refuses fewer than two seats", () => {
    expect([1, 2.5].map((seats) => createTable({ game, seats }))).toEqual([
      { ok: false, error: { code: "seat_count", seats: 1 } },
      { ok: false, error: { code: "seat_count", seats: 2.5 } },
    ]);
  });

  test("keeps none of the caller's objects, frozen or not", () => {
    const setup = {
      game: holdem.noLimit({ blinds: [1, 2], minBet: 2 }),
      seats: 6,
    };
    const deck = [...shuffle(decks.standard, seededRandom(10))];
    const start = Object.freeze({ type: "startHand", deck } as const);
    const table = run(
      joinAll([
        ["a", 0, 100],
        ["b", 1, 100],
      ]),
      [start]
    ).table;
    const created = okValue(createTable(setup));
    const text = serializeTable(table);
    deck.reverse();
    expect(Object.isFrozen(setup.game)).toBe(false);
    expect(Object.isFrozen(deck)).toBe(false);
    expect(serializeTable(table)).toBe(text);
    expect(parseTable(text).ok).toBe(true);
    expect(viewTable(created, auditor).game).toEqual(setup.game);
  });

  test("keeps an earlier table as it was when a caller writes to it", () => {
    const state = tableStateOf(threeSeated);
    expect(() => {
      Object.assign(state.seats, { 0: { player: "z", stack: 1 } });
    }).toThrow(TypeError);
    expect(viewTable(threeSeated, auditor).seats[0]).toBeNull();
  });
});

function pick<T>(items: readonly T[], random: RandomSource): T {
  const item = items[randomBelow(items.length, random)];
  if (item === undefined) throw new Error("Picked from an empty list");
  return item;
}

function chance(percent: number, random: RandomSource): boolean {
  return randomBelow(100, random) < percent;
}

const sessionGames: readonly Game[] = [
  game,
  stud.fixedLimit({ bringIn: 1, smallBet: 2, bigBet: 4 }),
  draw.badugi({ blinds: [1, 2], smallBet: 2, bigBet: 4 }),
];

type Choice = { readonly player: PlayerId; readonly action: PlayerAction };

/** Tables automate everything else, so these are the only decisions left. */
function chooseAction(hand: HandView, random: RandomSource): Choice {
  const { decision } = hand;
  switch (decision.kind) {
    case "betting": {
      const options: PlayerAction[] = [];
      if (decision.checkOrCall !== null) options.push({ type: "checkOrCall" });
      if (decision.fold === "standard") options.push({ type: "fold" });
      if (decision.betOrRaiseTo !== null) {
        const { min, max } = decision.betOrRaiseTo;
        const top = max === "unbounded" ? min : max;
        const amount = min + randomBelow(top - min + 1, random);
        options.push({ type: "betOrRaiseTo", amount });
      }
      if (decision.bringIn !== null) options.push({ type: "postBringIn" });
      return { player: decision.player, action: pick(options, random) };
    }
    case "drawing": {
      const held =
        hand.players.find(({ player }) => player === decision.player)
          ?.holeCards ?? [];
      const discard = held
        .filter(() => chance(40, random))
        .slice(0, decision.maxDiscards)
        .map(({ card }) => card);
      return { player: decision.player, action: { type: "draw", discard } };
    }
    default:
      throw new Error(`A table asked for ${decision.kind}`);
  }
}

type Checkpoint = { readonly table: Table; readonly events: number };

type Session = {
  readonly seed: number;
  readonly checkpoints: readonly Checkpoint[];
  readonly commands: readonly TableCommand[];
  readonly events: readonly TableEvent[];
  readonly players: readonly PlayerId[];
};

function randomSession(seed: number): Session {
  const random = seededRandom(seed);
  const played = pick(sessionGames, random);
  let table = emptyTable(6, played);
  const checkpoints: Checkpoint[] = [{ table, events: 0 }];
  const commands: TableCommand[] = [];
  const events: TableEvent[] = [];
  const players: PlayerId[] = [];
  const send = (command: TableCommand) => {
    const next = actAtTable(table, command);
    if (!next.ok)
      throw new Error(`Seed ${seed}: ${JSON.stringify(next.error)}`);
    table = next.value.table;
    commands.push(command);
    events.push(...next.value.events);
    checkpoints.push({ table, events: events.length });
  };
  for (let round = 0; round < 10; round += 1) {
    for (const [seat, seated] of viewTable(table, auditor).seats.entries()) {
      if (seated === null && chance(50, random)) {
        const player = `n${players.length}`;
        players.push(player);
        const stack = 1 + randomBelow(60, random);
        send({ type: "join", player, seat, stack });
      } else if (
        seated !== null &&
        (seated.stack === 0 || chance(10, random))
      ) {
        send({ type: "leave", player: seated.player });
      } else if (seated !== null && chance(15, random)) {
        const type = seated.sittingOut ? "sitIn" : "sitOut";
        send({ type, player: seated.player });
      }
    }
    const dealt = viewTable(table, auditor).seats.filter(
      (seated) => seated !== null && seated.stack > 0 && !seated.sittingOut
    );
    if (dealt.length < 2) continue;
    send({
      type: "startHand",
      deck: shuffle(decks[played.rules.deck], random),
    });
    for (;;) {
      const view = viewTable(table, auditor);
      if (view.hand === null) break;
      const { player, action } = chooseAction(view.hand, random);
      send({ type: "act", player, expectedVersion: view.version, action });
    }
  }
  return { seed, checkpoints, commands, events, players };
}

function seesHoleCards(audience: Audience, player: PlayerId): boolean {
  return (
    audience.kind === "auditor" ||
    (audience.kind === "player" && audience.player === player)
  );
}

function learn(known: Set<string>, audience: Audience, body: TableEventBody) {
  if (body.type !== "handEvent") return;
  const event = body.event.body;
  switch (event.type) {
    case "holeDealt":
      for (const hole of event.cards) {
        if (hole.face === "up" || seesHoleCards(audience, event.player)) {
          known.add(hole.card);
        }
      }
      return;
    case "drew":
      if (seesHoleCards(audience, event.player)) {
        for (const card of event.discarded) known.add(card);
      }
      return;
    case "boardDealt":
    case "shown":
      for (const card of event.cards) known.add(card);
      return;
    default:
      return;
  }
}

const knownCard = /"([2-9TJQKA][cdhs])"/g;

function cardsIn(value: TableView | readonly TableEventView[]): string[] {
  return [...JSON.stringify(value).matchAll(knownCard)].map(
    ([, card]) => card ?? ""
  );
}

describe("random sessions", () => {
  const sessions = Array.from({ length: 12 }, (_, seed) => randomSession(seed));

  test("play many hands, so the checks below see real sessions", () => {
    const hands = sessions.map(
      (session) =>
        summarizeSession(session.checkpoints.at(-1)?.table ?? emptyTable())
          .hands
    );
    expect(hands.reduce((total, count) => total + count, 0)).toBeGreaterThan(
      60
    );
  });

  test("account for every chip: nets add up to the rake and unclaimed chips", () => {
    for (const { checkpoints, events } of sessions) {
      const last = checkpoints.at(-1)?.table ?? emptyTable();
      const taken = events.reduce(
        (total, { body }) =>
          body.type === "handEnded"
            ? total + body.record.rake + body.record.unclaimed
            : total,
        0
      );
      const nets = summarizeSession(last).players.map(({ net }) => net);
      expect(nets.reduce((total, net) => total + net, taken)).toBe(0);
      for (const { table } of checkpoints) {
        for (const stack of stacksOf(table)) {
          expect(stack === null || stack >= 0).toBe(true);
        }
      }
    }
  });

  test("carry each player's ending stack to their seat", () => {
    for (const { checkpoints } of sessions) {
      for (const { table } of checkpoints) {
        const view = viewTable(table, auditor);
        if (view.lastHand === null || view.hand !== null) continue;
        for (const { player, endingStack } of view.lastHand.players) {
          const seat = view.seats.find((seated) => seated?.player === player);
          if (seat === undefined || seat === null) continue;
          expect(endingStack).toBe(seat.stack);
        }
      }
    }
  });

  test("show each audience only cards it may know, in views and events", () => {
    const leaks = sessions.flatMap(({ seed, checkpoints, events, players }) => {
      const audiences: Audience[] = [
        { kind: "spectator" },
        ...players.map((player) => ({ kind: "player" as const, player })),
      ];
      return audiences.flatMap((audience) => {
        const known = new Set<string>();
        let learned = 0;
        return checkpoints.flatMap(({ table, events: count }) => {
          const seen: string[] = [];
          for (const event of events.slice(learned, count)) {
            learn(known, audience, event.body);
            seen.push(...cardsIn(tableEventsFor([event], audience)));
          }
          learned = count;
          seen.push(...cardsIn(viewTable(table, audience)));
          return seen
            .filter((card) => !known.has(card))
            .map((card) => ({ seed, audience, card }));
        });
      });
    });
    expect(leaks).toEqual([]);
  });

  test("store and load to a table that plays the same, every tenth command", () => {
    for (const { checkpoints, commands } of sessions) {
      for (const [index, { table }] of checkpoints.entries()) {
        if (index % 10 !== 0 && index !== checkpoints.length - 1) continue;
        const text = serializeTable(table);
        const parsed = parseTable(text);
        if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
        expect(JSON.parse(serializeTable(parsed.value))).toEqual(
          JSON.parse(text)
        );
        expect(viewTable(parsed.value, auditor)).toEqual(
          viewTable(table, auditor)
        );
        const command = commands[index];
        if (command === undefined) continue;
        expect(actAtTable(parsed.value, command)).toEqual(
          actAtTable(table, command)
        );
      }
    }
  });
});

describe("serializeTable and parseTable", () => {
  const table = run(
    joinAll([
      ["a", 0, 100],
      ["b", 1, 100],
    ]),
    [{ type: "startHand", deck: shuffle(decks.standard, seededRandom(9)) }]
  ).table;

  test("keep only the running hand's commands, however long the table has run", () => {
    let current = joinAll([
      ["a", 0, 100],
      ["b", 1, 100],
      ["c", 2, 100],
    ]);
    const random = seededRandom(11);
    for (let hand = 0; hand < 30; hand += 1) {
      current = run(current, [
        { type: "startHand", deck: shuffle(decks.standard, random) },
      ]).table;
      while (viewTable(current, auditor).hand !== null) {
        const decision = viewTable(current, auditor).hand?.decision;
        if (decision?.kind !== "betting") throw new Error("Not betting");
        current = run(current, [
          actAs(current, decision.player, { type: "checkOrCall" }),
        ]).table;
      }
    }
    expect(JSON.parse(serializeTable(current)).commands).toEqual([]);
    const sinceStart: TableCommand[] = [
      { type: "startHand", deck: shuffle(decks.standard, random) },
      { type: "join", player: "d", seat: 3, stack: 50 },
    ];
    current = run(current, sinceStart).table;
    const decision = viewTable(current, auditor).hand?.decision;
    if (decision?.kind !== "betting") throw new Error("Not betting");
    const call = actAs(current, decision.player, { type: "checkOrCall" });
    current = run(current, [call]).table;
    const text = serializeTable(current);
    const stamped = {
      ...call,
      action: { ...call.action, player: call.player },
    };
    expect(JSON.parse(text).commands).toEqual([...sinceStart, stamped]);
    const parsed = okValue(parseTable(text));
    expect(viewTable(parsed, auditor)).toEqual(viewTable(current, auditor));
    expect(summarizeSession(parsed)).toEqual(summarizeSession(current));
  });

  test("refuse a command the replay rejects", () => {
    const stored = JSON.parse(serializeTable(table));
    stored.checkpoint.seats[1] = null;
    expect(parseTable(JSON.stringify(stored))).toEqual({
      ok: false,
      error: {
        code: "rejected",
        index: 0,
        violation: { code: "not_enough_players", players: 1 },
      },
    });
  });

  test("name the first field that does not parse", () => {
    const stored = JSON.parse(serializeTable(table));
    stored.checkpoint.seats[0].stack = "all of it";
    expect(parseTable(JSON.stringify(stored))).toMatchObject({
      ok: false,
      error: { code: "invalid_format", path: "checkpoint.seats.0.stack" },
    });
  });

  test("return an error for any text that is not a stored table", () => {
    const hand = JSON.stringify({ format: 1, setup: { game, seats: 2 } });
    const inputs = ["", "not json", "null", "{}", "[]", hand];
    expect(inputs.map((input) => parseTable(input).ok)).toEqual(
      inputs.map(() => false)
    );
  });
});
