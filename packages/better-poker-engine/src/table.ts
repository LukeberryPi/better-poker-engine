import type { Brandable, Opaque } from "./brand.ts";
import { decks } from "./cards.ts";
import type { Deck } from "./cards.ts";
import { isChips } from "./chips.ts";
import type { Chips } from "./chips.ts";
import type { HandEvent, HandRecord } from "./events.ts";
import { act, automation, startHand, summarizeHand } from "./hand.ts";
import type {
  Hand,
  PlayerAction,
  PlayerId,
  SetupError,
  Violation,
} from "./hand.ts";
import { copyGame } from "./hand/setup.ts";
import { at, deepFreeze, sealed } from "./hand/state.ts";
import { err, ok } from "./result.ts";
import type { Result } from "./result.ts";
import { validateGame } from "./rules.ts";
import type { Game, GameError } from "./rules.ts";
import { planHand } from "./seating.ts";
import type { ButtonRule, Owed, Rotation, SeatState } from "./seating.ts";
import { engineVersion } from "./version.ts";
import { eventsFor, viewHand, viewRecord } from "./views.ts";
import type {
  Audience,
  HandEventView,
  HandRecordView,
  HandView,
} from "./views.ts";

/** Seated players, the running hand and the session so far. Read it through `viewTable`. */
export type Table = Opaque<"Table">;

export type TableSetup = {
  readonly game: Game;
  /** Seats are numbered from 0, clockwise. */
  readonly seats: number;
  /** "moving" unless given; a dead button takes blinds of `[small, big]`. */
  readonly button?: ButtonRule;
};

export type TableSetupError =
  | GameError
  | { readonly code: "seat_count"; readonly seats: number }
  | {
      readonly code: "blinds_for_dead_button";
      readonly blinds: ReadonlyArray<number>;
    };

export type TableCommand =
  | {
      readonly type: "join";
      readonly player: PlayerId;
      readonly seat: number;
      readonly stack: Chips;
    }
  | { readonly type: "leave"; readonly player: PlayerId }
  /** Keeps the seat and stack but deals the player out from the next hand. */
  | { readonly type: "sitOut"; readonly player: PlayerId }
  | { readonly type: "sitIn"; readonly player: PlayerId }
  /** Under a dead button: post the blinds owed at the next hand, not wait for the big blind. */
  | { readonly type: "postBlinds"; readonly player: PlayerId }
  /** `deck` is the game's whole deck, shuffled. `button` places the first hand's button,
   * on that seat or the next player after it: pick it at random. */
  | {
      readonly type: "startHand";
      readonly deck: Deck;
      readonly button?: number;
    }
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
  | { readonly code: "already_sitting_out"; readonly player: PlayerId }
  | { readonly code: "not_sitting_out"; readonly player: PlayerId }
  | { readonly code: "nothing_owed"; readonly player: PlayerId }
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
      readonly type: "satOut";
      readonly player: PlayerId;
      readonly seat: number;
    }
  | { readonly type: "satIn"; readonly player: PlayerId; readonly seat: number }
  | {
      readonly type: "postingBlinds";
      readonly player: PlayerId;
      readonly seat: number;
    }
  | {
      readonly type: "handStarted";
      readonly hand: number;
      /** An empty seat when the button is dead. */
      readonly button: number;
      /** The seat at each position. */
      readonly seats: ReadonlyArray<number>;
      /** Null when the small blind is dead. */
      readonly smallBlind: number | null;
      readonly bigBlind: number;
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
  readonly events: ReadonlyArray<TableEvent>;
};

type SeatedPlayer = SeatState;

type RunningHand = {
  readonly number: number;
  readonly hand: Hand;
  /** The seat at each position. */
  readonly seats: ReadonlyArray<number>;
  /** The table before this hand started, and every command since: what storage replays. */
  readonly from: TableCheckpoint;
  readonly commands: ReadonlyArray<TableCommand>;
};

type SessionEntry = {
  readonly player: PlayerId;
  readonly boughtIn: Chips;
  readonly cashedOut: Chips;
  readonly hands: number;
};

/** A table with no hand running. */
export type TableCheckpoint = {
  readonly version: number;
  readonly eventCount: number;
  readonly seats: ReadonlyArray<SeatedPlayer | null>;
  /** Null until the first hand. */
  readonly rotation: Rotation | null;
  readonly hands: number;
  readonly lastHand: HandRecord | null;
  readonly session: ReadonlyArray<SessionEntry>;
};

export type TableState = Brandable<"Table"> &
  TableCheckpoint & {
    readonly setup: TableSetup;
    readonly hand: RunningHand | null;
  };

export function tableStateOf(table: Table): TableState {
  // SAFETY: only `tableFrom` creates a Table, from a TableState.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an Opaque brand can only be granted, never inferred.
  return table as TableState;
}

function tableFrom(state: TableState): Table {
  // SAFETY: TableState carries the optional Table brand; this grants it.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an Opaque brand can only be granted, never inferred.
  return deepFreeze(sealed(state, "Table")) as Table;
}

export function createTable(setup: TableSetup): Result<Table, TableSetupError> {
  const gameError = validateGame(setup.game);
  if (gameError !== null) {
    return err(gameError);
  }
  if (!Number.isSafeInteger(setup.seats) || setup.seats < 2) {
    return err({ code: "seat_count", seats: setup.seats });
  }
  const button = setup.button ?? "moving";
  const { blinds } = setup.game.forcedBets;
  if (
    button === "dead" &&
    (blinds.length !== 2 || !blinds.every((blind) => blind > 0))
  ) {
    return err({ code: "blinds_for_dead_button", blinds: [...blinds] });
  }
  return ok(
    tableFrom({
      setup: { game: copyGame(setup.game), seats: setup.seats, button },
      version: 0,
      eventCount: 0,
      seats: Array.from({ length: setup.seats }, () => null),
      rotation: null,
      hands: 0,
      hand: null,
      lastHand: null,
      session: [],
    })
  );
}

export function checkpointOf(state: TableState): TableCheckpoint {
  const { version, eventCount, seats, rotation, hands, lastHand, session } =
    state;
  return { version, eventCount, seats, rotation, hands, lastHand, session };
}

/** `empty` is a new table from `createTable`, which checked its setup. */
export function resumeTable(empty: Table, checkpoint: TableCheckpoint): Table {
  return tableFrom({ ...tableStateOf(empty), ...checkpoint });
}

type Change = {
  readonly state: TableState;
  readonly bodies: ReadonlyArray<TableEventBody>;
  readonly command: TableCommand;
};

/** The one write at a table; every accepted command moves `version` on by one. */
export function actAtTable(
  table: Table,
  command: TableCommand
): Result<TableTransition, TableRejection> {
  const state = tableStateOf(table);
  const change = applyCommand(state, command);
  if (!change.ok) {
    return err({ attempt: command, violation: change.error });
  }
  const version = state.version + 1;
  const events = change.value.bodies.map((body, index): TableEvent => ({
    seq: state.eventCount + index + 1,
    version,
    body,
  }));
  const { hand } = change.value.state;
  const next: TableState = {
    ...change.value.state,
    version,
    eventCount: state.eventCount + events.length,
    hand:
      hand === null
        ? null
        : {
            ...hand,
            commands: [...hand.commands, copyCommand(change.value.command)],
          },
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
    case "sitOut":
    case "sitIn":
      return sit(state, command);
    case "postBlinds":
      return postBlinds(state, command);
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
  if (seated === null) {
    throw new Error(`Seat ${seat} is empty`);
  }
  return seated;
}

function updateSession(
  session: ReadonlyArray<SessionEntry>,
  player: PlayerId,
  update: (entry: SessionEntry) => SessionEntry
): Array<SessionEntry> {
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
  const owes: Owed =
    state.setup.button === "dead" && state.rotation !== null
      ? "bigBlind"
      : "nothing";
  return ok({
    state: {
      ...state,
      seats: state.seats.with(seat, {
        player,
        stack,
        sittingOut: false,
        owes,
        posting: false,
      }),
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
  if (seat === null) {
    return err({ code: "not_seated", player });
  }
  if (state.hand?.seats.includes(seat)) {
    return err({ code: "in_hand", player });
  }
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

function sit(
  state: TableState,
  command: Extract<TableCommand, { type: "sitOut" | "sitIn" }>
): Result<Change, TableViolation> {
  const { player } = command;
  const seat = seatOf(state, player);
  if (seat === null) {
    return err({ code: "not_seated", player });
  }
  const seated = occupant(state, seat);
  const sittingOut = command.type === "sitOut";
  if (seated.sittingOut === sittingOut) {
    return err({
      code: sittingOut ? "already_sitting_out" : "not_sitting_out",
      player,
    });
  }
  return ok({
    state: {
      ...state,
      seats: state.seats.with(seat, { ...seated, sittingOut }),
    },
    bodies: [{ type: sittingOut ? "satOut" : "satIn", player, seat }],
    command,
  });
}

function postBlinds(
  state: TableState,
  command: Extract<TableCommand, { type: "postBlinds" }>
): Result<Change, TableViolation> {
  const { player } = command;
  const seat = seatOf(state, player);
  if (seat === null) {
    return err({ code: "not_seated", player });
  }
  const seated = occupant(state, seat);
  if (seated.owes === "nothing") {
    return err({ code: "nothing_owed", player });
  }
  return ok({
    state: {
      ...state,
      seats: state.seats.with(seat, { ...seated, posting: true }),
    },
    bodies: [{ type: "postingBlinds", player, seat }],
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

function deal(
  state: TableState,
  command: Extract<TableCommand, { type: "startHand" }>
): Result<Change, TableViolation> {
  if (state.hand !== null) {
    return err({ code: "hand_running" });
  }
  const { game } = state.setup;
  if (!isWholeDeck(command.deck, decks[game.rules.deck])) {
    return err({ code: "not_a_full_deck" });
  }
  const planned = planHand({
    game,
    seats: state.seats,
    button: state.setup.button ?? "moving",
    rotation: state.rotation,
    firstButton: command.button ?? 0,
  });
  if (!planned.ok) {
    return err(planned.error);
  }
  const { positions: seats, rotation, smallBlind, bigBlind } = planned.value;
  const players = seats.map((seat) => occupant(state, seat));
  const started = startHand({
    game: planned.value.game,
    players: players.map(({ player }) => player),
    stacks: players.map(({ stack }) => stack),
    deck: command.deck,
    automate: automation.all,
  });
  if (!started.ok) {
    return err({ code: "setup", error: started.error });
  }
  const number = state.hands + 1;
  const { hand, events } = started.value;
  return ok(
    settle(
      {
        ...state,
        seats: planned.value.seats,
        rotation,
        hands: number,
        hand: { number, hand, seats, from: checkpointOf(state), commands: [] },
      },
      [
        {
          type: "handStarted",
          hand: number,
          button: rotation.button,
          seats,
          smallBlind,
          bigBlind,
        },
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
  if (running === null) {
    return err({ code: "no_hand" });
  }
  const action: PlayerAction = { ...command.action, player };
  const next = act(running.hand, action);
  if (!next.ok) {
    return next;
  }
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
  events: ReadonlyArray<HandEvent>
): Array<TableEventBody> {
  return events.map((event) => ({ type: "handEvent", hand, event }));
}

/** Ends the running hand once it is complete: stacks carry over and the record is kept. */
function settle(
  state: TableState,
  bodies: ReadonlyArray<TableEventBody>,
  command: TableCommand
): Change {
  const running = state.hand;
  const record = running === null ? null : summarizeHand(running.hand);
  if (running === null || record === null) {
    return { state, bodies, command };
  }
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
  /** Not dealt in from the next hand on; a running hand they hold cards in still needs them. */
  readonly sittingOut: boolean;
  /** Under a dead button: blinds to post before the big blind comes round. */
  readonly owes: Owed;
  readonly posting: boolean;
};

export type TableView = {
  readonly audience: Audience;
  readonly version: number;
  readonly game: Game;
  /** One per seat; null when empty. */
  readonly seats: ReadonlyArray<SeatView | null>;
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
    button: state.rotation?.button ?? null,
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
      if (event === undefined) {
        throw new Error("eventsFor dropped an event");
      }
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
  events: ReadonlyArray<TableEvent>,
  audience: Audience
): ReadonlyArray<TableEventView> {
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
  readonly players: ReadonlyArray<SessionPlayer>;
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
