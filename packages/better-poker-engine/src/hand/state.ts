import type { Brandable } from "../brand.ts";
import { isKnownCard } from "../cards.ts";
import type { Card, Deck, KnownCard } from "../cards.ts";
import type { Chips, Stack } from "../chips.ts";
import { evaluate } from "../evaluation.ts";
import type { HandValue } from "../evaluation.ts";
import type {
  Action,
  AutomatedStep,
  Hand,
  HoleCard,
  PlayerId,
} from "../hand.ts";
import type { Seed } from "../random.ts";
import type { Face, Game, Street } from "../rules.ts";

/** A seat index: 0 is the small blind, as pokerkit's player indices. */
export type Position = number;

export type PotState = {
  raked: Chips;
  unraked: Chips;
  readonly eligible: ReadonlyArray<Position>;
};

/** A pot as it stood when betting closed for good, before anyone showed or mucked. */
export type ContestedPot = {
  readonly amount: Chips;
  readonly eligible: ReadonlyArray<Position>;
};

export type SubPot = {
  readonly amount: Chips;
  readonly pot: number;
  /** Null when one player is left: they take the whole pot. */
  readonly board: number | null;
  /** Null as well when no hand of any type qualifies on the board. */
  readonly handType: number | null;
};

type Pending<Kind extends string> = {
  readonly kind: Kind;
  readonly pending: Array<boolean>;
};

export type Dealing = {
  readonly kind: "dealing";
  burn: boolean;
  /** Faces of the hole cards each player is still owed. */
  readonly hole: Array<Array<Face>>;
  /** Cards each board is still owed. */
  readonly board: Array<number>;
  readonly draw: Array<boolean>;
};

export type Betting = {
  readonly kind: "betting";
  bringIn: boolean;
  completion: boolean;
  actors: Array<Position>;
  /** The largest raise so far; pokerkit's `completion_betting_or_raising_amount`. */
  lastRaise: Chips;
  raises: number;
  acted: Array<Position>;
  shortAllIns: Array<Chips>;
};

export type Showdown = {
  readonly kind: "showdown";
  readonly selectors: Array<boolean>;
  order: Array<Position>;
};

export type Phase =
  | Pending<"antePosting">
  | { readonly kind: "betCollection"; pending: boolean }
  | Pending<"blindPosting">
  | Dealing
  | Betting
  | Showdown
  | Pending<"handKilling">
  | { readonly kind: "chipsPushing"; readonly subPots: Array<SubPot> }
  | Pending<"chipsPulling">
  | { readonly kind: "complete" };

export type Runout = { readonly returnStreet: number; remaining: number };

export type LoggedAction = {
  readonly action: Action;
  readonly commentary: string | null;
};

/** pokerkit's `State` fields, mutated in place on a private copy per action. */
export type HandState = Brandable<"Hand"> & {
  readonly game: Game;
  readonly players: ReadonlyArray<PlayerId>;
  readonly automate: ReadonlyArray<AutomatedStep>;
  readonly antes: ReadonlyArray<Chips>;
  readonly blinds: ReadonlyArray<number>;
  readonly startingStacks: ReadonlyArray<Stack>;
  version: number;
  readonly startingDeck: Deck;
  deck: Array<Card>;
  /** Hashed from the starting deck, so players can't predict a reshuffle. */
  readonly reshuffleSeed: Seed;
  /** pokerkit's `board_cards`: one entry per dealt slot, one card per board. */
  boards: Array<Array<Card>>;
  burned: Array<Card>;
  mucked: Array<Card>;
  /** Per street. */
  discarded: Array<Array<Card>>;
  readonly active: Array<boolean>;
  readonly bets: Array<Chips>;
  readonly stacks: Array<Stack>;
  readonly payoffs: Array<number>;
  readonly hole: Array<Array<HoleCard>>;
  /** What each player held when they folded or mucked, for the record. */
  readonly retired: Array<Array<HoleCard>>;
  street: number | null;
  runout: Runout | null;
  allIn: boolean;
  opener: Position | null;
  runoutCount: number | null;
  runoutCountSelected: boolean;
  /** Frozen once chips pushing begins. */
  pots: Array<PotState> | null;
  /** Mucks can merge `pots`, as in pokerkit; the record reports these instead. */
  contestedPots: ReadonlyArray<ContestedPot> | null;
  phase: Phase;
  /** Accepted actions only: events replay from them, so a hand stays small. */
  log: ReadonlyArray<LoggedAction>;
};

export function stateOf(hand: Hand): HandState {
  // SAFETY: only `handFrom` creates a Hand, from a HandState.
  return hand as HandState;
}

/** Skips frozen objects: everything a hand holds was frozen whole when first reached. */
export function deepFreeze<T extends NonNullable<unknown>>(value: T): T {
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child !== null && child !== undefined) {
      deepFreeze(child);
    }
  }
  return value;
}

const nodeInspect = Symbol.for("nodejs.util.inspect.custom");

/** Hands and tables hold the deck and every hole card, so `JSON.stringify` throws and
 * Node's inspector prints nothing: a stray log line or `res.json` can't leak them. */
export function sealed<T extends NonNullable<unknown>>(
  value: T,
  kind: "Hand" | "Table"
): T {
  Object.defineProperties(value, {
    toJSON: {
      value: () => {
        throw new TypeError(
          `A ${kind} holds the deck and every hole card: store it with serialize${kind} and send view${kind} to clients`
        );
      },
    },
    [nodeInspect]: { value: () => `${kind} [sealed]` },
  });
  return value;
}

export function handFrom(state: HandState): Hand {
  // SAFETY: HandState carries the optional Hand brand; this grants it.
  return deepFreeze(sealed(state, "Hand")) as Hand;
}

function clonePhase(phase: Phase): Phase {
  switch (phase.kind) {
    case "antePosting":
    case "blindPosting":
    case "handKilling":
    case "chipsPulling":
      return { kind: phase.kind, pending: [...phase.pending] };
    case "betCollection":
      return { ...phase };
    case "dealing":
      return {
        ...phase,
        hole: phase.hole.map((faces) => [...faces]),
        board: [...phase.board],
        draw: [...phase.draw],
      };
    case "betting":
      return {
        ...phase,
        actors: [...phase.actors],
        acted: [...phase.acted],
        shortAllIns: [...phase.shortAllIns],
      };
    case "showdown":
      return {
        ...phase,
        selectors: [...phase.selectors],
        order: [...phase.order],
      };
    case "chipsPushing":
      return { kind: phase.kind, subPots: [...phase.subPots] };
    case "complete":
      return phase;
  }
}

export function cloneState(state: HandState): HandState {
  return {
    ...state,
    deck: [...state.deck],
    boards: state.boards.map((slot) => [...slot]),
    burned: [...state.burned],
    mucked: [...state.mucked],
    discarded: state.discarded.map((cards) => [...cards]),
    active: [...state.active],
    bets: [...state.bets],
    stacks: [...state.stacks],
    payoffs: [...state.payoffs],
    hole: state.hole.map((cards) => [...cards]),
    retired: state.retired.map((cards) => [...cards]),
    runout: state.runout === null ? null : { ...state.runout },
    pots: state.pots?.map((pot) => ({ ...pot })) ?? null,
    phase: clonePhase(state.phase),
  };
}

export function positionsOf(state: HandState): Array<Position> {
  return state.players.map((_, position) => position);
}

export function playerAt(state: HandState, position: Position): PlayerId {
  const player = state.players[position];
  if (player === undefined) {
    throw new Error(`No player at ${position}`);
  }
  return player;
}

export function at<T>(values: ReadonlyArray<T>, index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`No value at ${index}`);
  }
  return value;
}

export function sum(values: ReadonlyArray<number>): number {
  return values.reduce((total, value) => total + value, 0);
}

export function maxBet(state: HandState): Chips {
  return Math.max(...state.bets);
}

export function activeCount(state: HandState): number {
  return state.active.filter(Boolean).length;
}

/** pokerkit's `rotated`: positions starting from `first`. */
export function rotatedFrom(
  state: HandState,
  first: Position
): Array<Position> {
  const positions = positionsOf(state);
  return [...positions.slice(first), ...positions.slice(0, first)];
}

export function streetAt(state: HandState, index: number): Street {
  return at(state.game.rules.streets, index);
}

export function currentStreet(state: HandState): Street {
  if (state.street === null) {
    throw new Error("No street is in progress");
  }
  return streetAt(state, state.street);
}

export function isLastStreet(state: HandState): boolean {
  return state.street === state.game.rules.streets.length - 1;
}

export function laterStreets(state: HandState): ReadonlyArray<Street> {
  return state.game.rules.streets.slice((state.street ?? -1) + 1);
}

export function upCards(state: HandState, position: Position): Array<Card> {
  return at(state.hole, position)
    .filter((hole) => hole.face === "up")
    .map((hole) => hole.card);
}

export function allFaceUp(state: HandState, position: Position): boolean {
  return at(state.hole, position).every((hole) => hole.face === "up");
}

/** Every board once runouts multiply them; pokerkit's `board_count`. */
export function boardCount(state: HandState): number {
  return state.runout === null
    ? state.game.boards
    : state.game.boards * (state.runoutCount ?? 1);
}

/** pokerkit's `get_board_cards`: runouts share the cards dealt before them. */
export function boardCards(state: HandState, board: number): Array<Card> {
  let shared = 0;
  if (state.runout !== null) {
    for (const street of state.game.rules.streets.slice(
      0,
      state.runout.returnStreet
    )) {
      shared += street.board;
    }
  }
  const runouts = state.runoutCount ?? 1;
  return state.boards.flatMap((slot, index) => {
    const card = slot[index < shared ? Math.floor(board / runouts) : board];
    return card === undefined ? [] : [card];
  });
}

function knownCards(cards: ReadonlyArray<Card>): Array<KnownCard> {
  return cards.filter(isKnownCard);
}

/** pokerkit's `get_hand`: from every known hole card. */
export function bestHandOf(
  state: HandState,
  position: Position,
  board: number,
  handType: number
): HandValue | null {
  if (!at(state.active, position)) {
    return null;
  }
  return evaluate(
    at(state.game.rules.handTypes, handType),
    knownCards(at(state.hole, position).map((hole) => hole.card)),
    knownCards(boardCards(state, board))
  );
}

/** pokerkit's `get_up_hand`: from the hole cards face up only. */
export function upHandOf(
  state: HandState,
  position: Position,
  board: number,
  handType: number
): HandValue | null {
  if (!at(state.active, position)) {
    return null;
  }
  return evaluate(
    at(state.game.rules.handTypes, handType),
    knownCards(upCards(state, position)),
    knownCards(boardCards(state, board))
  );
}

/** pokerkit's `min_or_none`: the first smallest by `key`, skipping nulls. */
export function minOrNull<T>(
  values: ReadonlyArray<T | null>,
  key: (value: T) => number
): T | null {
  let best: T | null = null;
  for (const value of values) {
    if (value !== null && (best === null || key(value) < key(best))) {
      best = value;
    }
  }
  return best;
}

/** pokerkit's `max_or_none`: the first largest by `key`, skipping nulls. */
export function maxOrNull<T>(
  values: ReadonlyArray<T | null>,
  key: (value: T) => number
): T | null {
  let best: T | null = null;
  for (const value of values) {
    if (value !== null && (best === null || key(value) > key(best))) {
      best = value;
    }
  }
  return best;
}

export function muck(state: HandState, position: Position): void {
  const cards = at(state.hole, position);
  state.mucked.push(...cards.map((hole) => hole.card));
  state.retired[position] = cards;
  state.hole[position] = [];
  state.active[position] = false;
}
