import type { Brandable, Opaque } from "./brand.ts";
import { decks, type Deck } from "./cards.ts";
import { isChips, type Chips } from "./chips.ts";
import type { HandEvent, HandRecord } from "./events.ts";
import {
  act,
  automation,
  startHand,
  summarizeHand,
  type Hand,
  type PlayerAction,
  type PlayerId,
  type SetupError,
  type Violation,
} from "./hand.ts";
import { copyGame } from "./hand/setup.ts";
import { at, deepFreeze } from "./hand/state.ts";
import { err, ok, type Result } from "./result.ts";
import { validateGame, type Game, type GameError } from "./rules.ts";
import { engineVersion } from "./version.ts";
import {
  eventsFor,
  viewHand,
  viewRecord,
  type Audience,
  type HandEventView,
  type HandRecordView,
  type HandView,
} from "./views.ts";

/** Seated players, the running hand and the session so far. Read it through `viewTable`. */
export type Table = Opaque<"Table">;

export type TableSetup = {
  readonly game: Game;
  /** Seats are numbered from 0, clockwise. */
  readonly seats: number;
};

export type TableSetupError =
  | GameError
  | { readonly code: "seat_count"; readonly seats: number };

export type TableCommand =
  | {
      readonly type: "join";
      readonly player: PlayerId;
      readonly seat: number;
      readonly stack: Chips;
    }
  | { readonly type: "leave"; readonly player: PlayerId }
  /** `deck` is the game's whole deck, shuffled. */
  | { readonly type: "startHand"; readonly deck: Deck }
  /** `player` is who the caller authenticated; it replaces `action.player`. */
  | {
      readonly type: "act";
      readonly player: PlayerId;
      /** The table `version` the player saw. */
      readonly expectedVersion: number;
      readonly action: PlayerAction;
    };

type NotAtTables = Extract<
  PlayerAction["type"],
  "show" | "muck" | "selectRunoutCount"
>;

export type TableViolation =
  | Violation
  | { readonly code: "no_such_seat"; readonly seat: number }
  | {
      readonly code: "seat_taken";
      readonly seat: number;
      readonly player: PlayerId;
    }
  | {
      readonly code: "already_seated";
      readonly player: PlayerId;
      readonly seat: number;
    }
  | { readonly code: "invalid_buy_in"; readonly stack: number }
  | { readonly code: "not_seated"; readonly player: PlayerId }
  | { readonly code: "in_hand"; readonly player: PlayerId }
  | { readonly code: "hand_running" }
  | { readonly code: "no_hand" }
  | { readonly code: "not_enough_players"; readonly players: number }
  /** Tables never name cards, so a partial deck could stall a hand. */
  | { readonly code: "not_a_full_deck" }
  | { readonly code: "setup"; readonly error: SetupError }
  /** adrs.md 19: tables automate runouts and showdowns. */
  | { readonly code: "not_at_tables"; readonly attempted: NotAtTables };

/** Carries the attempt so it can be stored next to the accepted commands. */
export type TableRejection = {
  readonly attempt: TableCommand;
  readonly violation: TableViolation;
};

export type TableEventBody =
  | {
      readonly type: "joined";
      readonly player: PlayerId;
      readonly seat: number;
      readonly stack: Chips;
    }
  | {
      readonly type: "left";
      readonly player: PlayerId;
      readonly seat: number;
      readonly stack: Chips;
    }
  | {
      readonly type: "handStarted";
      readonly hand: number;
      readonly button: number;
      /** The seat at each position. */
      readonly seats: readonly number[];
    }
  | {
      readonly type: "handEvent";
      readonly hand: number;
      readonly event: HandEvent;
    }
  | {
      readonly type: "handEnded";
      readonly hand: number;
      readonly record: HandRecord;
    };

export type TableEvent = {
  /** Counts every event the table has emitted. */
  readonly seq: number;
  /** The table's version after the command that caused it. */
  readonly version: number;
  readonly body: TableEventBody;
};

export type TableTransition = {
  readonly table: Table;
  /** Auditor data: pass them through `tableEventsFor` before sending them. */
  readonly events: readonly TableEvent[];
};

type SeatedPlayer = { readonly player: PlayerId; readonly stack: Chips };

type RunningHand = {
  readonly number: number;
  readonly hand: Hand;
  /** The seat at each position. */
  readonly seats: readonly number[];
};

type SessionEntry = {
  readonly player: PlayerId;
  readonly boughtIn: Chips;
  readonly cashedOut: Chips;
  readonly hands: number;
};

export type TableState = Brandable<"Table"> & {
  readonly setup: TableSetup;
  readonly version: number;
  readonly eventCount: number;
  readonly seats: readonly (SeatedPlayer | null)[];
  readonly button: number | null;
  readonly hands: number;
  readonly hand: RunningHand | null;
  readonly lastHand: HandRecord | null;
  readonly session: readonly SessionEntry[];
  readonly commands: readonly TableCommand[];
};

export function tableStateOf(table: Table): TableState {
  // SAFETY: only `tableFrom` creates a Table, from a TableState.
  return table as TableState;
}

function tableFrom(state: TableState): Table {
  // SAFETY: TableState carries the optional Table brand; this grants it.
  return deepFreeze(state) as Table;
}

export function createTable(setup: TableSetup): Result<Table, TableSetupError> {
  const gameError = validateGame(setup.game);
  if (gameError !== null) return err(gameError);
  if (!Number.isSafeInteger(setup.seats) || setup.seats < 2) {
    return err({ code: "seat_count", seats: setup.seats });
  }
  return ok(
    tableFrom({
      setup: { game: copyGame(setup.game), seats: setup.seats },
      version: 0,
      eventCount: 0,
      seats: Array.from({ length: setup.seats }, () => null),
      button: null,
      hands: 0,
      hand: null,
      lastHand: null,
      session: [],
      commands: [],
    })
  );
}

type Change = {
  readonly state: TableState;
  readonly bodies: readonly TableEventBody[];
  readonly command: TableCommand;
};

/** The one write at a table; every accepted command moves `version` on by one. */
export function actAtTable(
  table: Table,
  command: TableCommand
): Result<TableTransition, TableRejection> {
  const state = tableStateOf(table);
  const change = applyCommand(state, command);
  if (!change.ok) return err({ attempt: command, violation: change.error });
  const version = state.version + 1;
  const events = change.value.bodies.map((body, index): TableEvent => ({
    seq: state.eventCount + index + 1,
    version,
    body,
  }));
  const next: TableState = {
    ...change.value.state,
    version,
    eventCount: state.eventCount + events.length,
    commands: [...state.commands, copyCommand(change.value.command)],
  };
  return ok({ table: tableFrom(next), events });
}

function copyAction(action: PlayerAction): PlayerAction {
  switch (action.type) {
    case "draw":
      return { ...action, discard: [...action.discard] };
    case "show":
      return action.cards === undefined
        ? { ...action }
        : { ...action, cards: [...action.cards] };
    default:
      return { ...action };
  }
}

/** A private copy, so later edits to the caller's command never reach the table. */
function copyCommand(command: TableCommand): TableCommand {
  switch (command.type) {
    case "startHand":
      return { ...command, deck: [...command.deck] };
    case "act":
      return { ...command, action: copyAction(command.action) };
    default:
      return { ...command };
  }
}

function applyCommand(
  state: TableState,
  command: TableCommand
): Result<Change, TableViolation> {
  switch (command.type) {
    case "join":
      return join(state, command);
    case "leave":
      return leave(state, command);
    case "startHand":
      return deal(state, command);
    case "act":
      return play(state, command);
  }
}

function seatOf(state: TableState, player: PlayerId): number | null {
  const seat = state.seats.findIndex((seated) => seated?.player === player);
  return seat === -1 ? null : seat;
}

function occupant(state: TableState, seat: number): SeatedPlayer {
  const seated = at(state.seats, seat);
  if (seated === null) throw new Error(`Seat ${seat} is empty`);
  return seated;
}

function updateSession(
  session: readonly SessionEntry[],
  player: PlayerId,
  update: (entry: SessionEntry) => SessionEntry
): SessionEntry[] {
  const found = session.some((entry) => entry.player === player);
  const entries = found
    ? session
    : [...session, { player, boughtIn: 0, cashedOut: 0, hands: 0 }];
  return entries.map((entry) =>
    entry.player === player ? update(entry) : entry
  );
}

function join(
  state: TableState,
  command: Extract<TableCommand, { type: "join" }>
): Result<Change, TableViolation> {
  const { player, seat, stack } = command;
  if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.seats.length) {
    return err({ code: "no_such_seat", seat });
  }
  const taken = at(state.seats, seat);
  if (taken !== null) {
    return err({ code: "seat_taken", seat, player: taken.player });
  }
  const current = seatOf(state, player);
  if (current !== null) {
    return err({ code: "already_seated", player, seat: current });
  }
  if (!isChips(stack) || stack === 0) {
    return err({ code: "invalid_buy_in", stack });
  }
  return ok({
    state: {
      ...state,
      seats: state.seats.with(seat, { player, stack }),
      session: updateSession(state.session, player, (entry) => ({
        ...entry,
        boughtIn: entry.boughtIn + stack,
      })),
    },
    bodies: [{ type: "joined", player, seat, stack }],
    command,
  });
}

function leave(
  state: TableState,
  command: Extract<TableCommand, { type: "leave" }>
): Result<Change, TableViolation> {
  const { player } = command;
  const seat = seatOf(state, player);
  if (seat === null) return err({ code: "not_seated", player });
  if (state.hand?.seats.includes(seat)) return err({ code: "in_hand", player });
  const { stack } = occupant(state, seat);
  return ok({
    state: {
      ...state,
      seats: state.seats.with(seat, null),
      session: updateSession(state.session, player, (entry) => ({
        ...entry,
        cashedOut: entry.cashedOut + stack,
      })),
    },
    bodies: [{ type: "left", player, seat, stack }],
    command,
  });
}

function isWholeDeck(deck: Deck, whole: Deck): boolean {
  const cards = new Set(deck);
  return (
    deck.length === whole.length &&
    cards.size === whole.length &&
    whole.every((card) => cards.has(card))
  );
}

/** The first hand's button is the lowest seat dealt in; it then moves to the next one. */
function nextButton(state: TableState, dealt: readonly number[]): number {
  const { button } = state;
  const next = dealt.find((seat) => button === null || seat > button);
  return button === null ? at(dealt, 0) : (next ?? at(dealt, 0));
}

function deal(
  state: TableState,
  command: Extract<TableCommand, { type: "startHand" }>
): Result<Change, TableViolation> {
  if (state.hand !== null) return err({ code: "hand_running" });
  const { game } = state.setup;
  if (!isWholeDeck(command.deck, decks[game.rules.deck])) {
    return err({ code: "not_a_full_deck" });
  }
  const dealt = state.seats.flatMap((seated, seat) =>
    seated !== null && seated.stack > 0 ? [seat] : []
  );
  if (dealt.length < 2) {
    return err({ code: "not_enough_players", players: dealt.length });
  }
  const button = nextButton(state, dealt);
  const split = dealt.indexOf(button) + 1;
  const seats = [...dealt.slice(split), ...dealt.slice(0, split)];
  const players = seats.map((seat) => occupant(state, seat));
  const started = startHand({
    game,
    players: players.map(({ player }) => player),
    stacks: players.map(({ stack }) => stack),
    deck: command.deck,
    automate: automation.all,
  });
  if (!started.ok) return err({ code: "setup", error: started.error });
  const number = state.hands + 1;
  const { hand, events } = started.value;
  return ok(
    settle(
      { ...state, button, hands: number, hand: { number, hand, seats } },
      [
        { type: "handStarted", hand: number, button, seats },
        ...handEvents(number, events),
      ],
      command
    )
  );
}

function play(
  state: TableState,
  command: Extract<TableCommand, { type: "act" }>
): Result<Change, TableViolation> {
  const { expectedVersion, player } = command;
  if (expectedVersion !== state.version) {
    return err({
      code: "stale_version",
      expected: expectedVersion,
      current: state.version,
    });
  }
  const { type } = command.action;
  if (type === "show" || type === "muck" || type === "selectRunoutCount") {
    return err({ code: "not_at_tables", attempted: type });
  }
  const running = state.hand;
  if (running === null) return err({ code: "no_hand" });
  const action: PlayerAction = { ...command.action, player };
  const next = act(running.hand, action);
  if (!next.ok) return next;
  const { hand, events } = next.value;
  return ok(
    settle(
      { ...state, hand: { ...running, hand } },
      handEvents(running.number, events),
      { ...command, action }
    )
  );
}

function handEvents(
  hand: number,
  events: readonly HandEvent[]
): TableEventBody[] {
  return events.map((event) => ({ type: "handEvent", hand, event }));
}

/** Ends the running hand once it is complete: stacks carry over and the record is kept. */
function settle(
  state: TableState,
  bodies: readonly TableEventBody[],
  command: TableCommand
): Change {
  const running = state.hand;
  const record = running === null ? null : summarizeHand(running.hand);
  if (running === null || record === null) return { state, bodies, command };
  let { seats, session } = state;
  for (const { position, net } of record.players) {
    const seat = at(running.seats, position);
    const seated = occupant(state, seat);
    seats = seats.with(seat, { ...seated, stack: seated.stack + net });
    session = updateSession(session, seated.player, (entry) => ({
      ...entry,
      hands: entry.hands + 1,
    }));
  }
  return {
    state: { ...state, seats, session, hand: null, lastHand: record },
    bodies: [...bodies, { type: "handEnded", hand: running.number, record }],
    command,
  };
}

export type SeatView = {
  readonly player: PlayerId;
  /** Chips behind as of the last hand's end; the running hand's view has live stacks. */
  readonly stack: Chips;
  readonly inHand: boolean;
};

export type TableView = {
  readonly audience: Audience;
  readonly version: number;
  readonly game: Game;
  /** One per seat; null when empty. */
  readonly seats: readonly (SeatView | null)[];
  readonly button: number | null;
  readonly hands: number;
  readonly hand: HandView | null;
  readonly lastHand: HandRecordView | null;
};

export function viewTable(table: Table, audience: Audience): TableView {
  const state = tableStateOf(table);
  const running = state.hand;
  return {
    audience,
    version: state.version,
    game: state.setup.game,
    seats: state.seats.map((seated, seat) =>
      seated === null
        ? null
        : { ...seated, inHand: running?.seats.includes(seat) ?? false }
    ),
    button: state.button,
    hands: state.hands,
    hand: running === null ? null : viewHand(running.hand, audience),
    lastHand:
      state.lastHand === null ? null : viewRecord(state.lastHand, audience),
  };
}

export type TableEventView = {
  readonly seq: number;
  readonly version: number;
  readonly body:
    | Exclude<TableEventBody, { readonly type: "handEvent" | "handEnded" }>
    | {
        readonly type: "handEvent";
        readonly hand: number;
        readonly event: HandEventView;
      }
    | {
        readonly type: "handEnded";
        readonly hand: number;
        readonly record: HandRecordView;
      };
};

function redactTableEvent(
  { seq, version, body }: TableEvent,
  audience: Audience
): TableEventView {
  switch (body.type) {
    case "handEvent": {
      const [event] = eventsFor([body.event], audience);
      if (event === undefined) throw new Error("eventsFor dropped an event");
      return { seq, version, body: { ...body, event } };
    }
    case "handEnded":
      return {
        seq,
        version,
        body: { ...body, record: viewRecord(body.record, audience) },
      };
    default:
      return { seq, version, body };
  }
}

/** Replaces cards the audience may not see with "??", in hand events and records alike. */
export function tableEventsFor(
  events: readonly TableEvent[],
  audience: Audience
): readonly TableEventView[] {
  return events.map((event) => redactTableEvent(event, audience));
}

export type SessionPlayer = {
  readonly player: PlayerId;
  readonly boughtIn: Chips;
  readonly cashedOut: Chips;
  /** Null once the player has left. */
  readonly stack: Chips | null;
  /** Cashed out plus stack, less bought in. */
  readonly net: number;
  readonly hands: number;
};

/** The wide record of a session. A running hand counts at its starting stacks. */
export type SessionRecord = {
  readonly engineVersion: string;
  readonly hands: number;
  readonly players: readonly SessionPlayer[];
};

export function summarizeSession(table: Table): SessionRecord {
  const state = tableStateOf(table);
  const players = state.session.map((entry): SessionPlayer => {
    const seat = seatOf(state, entry.player);
    const stack = seat === null ? null : occupant(state, seat).stack;
    return {
      ...entry,
      stack,
      net: entry.cashedOut + (stack ?? 0) - entry.boughtIn,
    };
  });
  const hands = state.hands - (state.hand === null ? 0 : 1);
  return { engineVersion, hands, players };
}
