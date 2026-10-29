import type { Brandable } from "../brand.ts";
import { isKnownCard, type Card, type KnownCard } from "../cards.ts";
import type { Chips, Stack } from "../chips.ts";
import { evaluate, type HandValue } from "../evaluation.ts";
import type { HandEvent } from "../events.ts";
import type { AutomatedStep, Hand, HoleCard, PlayerId } from "../hand.ts";
import type { Seed } from "../random.ts";
import type { Face, Game, Street } from "../rules.ts";

/** A seat index: 0 is the small blind, as pokerkit's player indices. */
export type Position = number;

export type PotState = {
  raked: Chips;
  unraked: Chips;
  readonly eligible: readonly Position[];
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
  readonly pending: boolean[];
};

export type Dealing = {
  readonly kind: "dealing";
  burn: boolean;
  /** Faces of the hole cards each player is still owed. */
  readonly hole: Face[][];
  /** Cards each board is still owed. */
  readonly board: number[];
  readonly draw: boolean[];
};

export type Betting = {
  readonly kind: "betting";
  bringIn: boolean;
  completion: boolean;
  actors: Position[];
  /** The largest raise so far; pokerkit's `completion_betting_or_raising_amount`. */
  lastRaise: Chips;
  raises: number;
  acted: Position[];
  shortAllIns: Chips[];
};

export type Showdown = {
  readonly kind: "showdown";
  readonly selectors: boolean[];
  order: Position[];
};

export type Phase =
  | Pending<"antePosting">
  | { readonly kind: "betCollection"; pending: boolean }
  | Pending<"blindPosting">
  | Dealing
  | Betting
  | Showdown
  | Pending<"handKilling">
  | { readonly kind: "chipsPushing"; readonly subPots: SubPot[] }
  | Pending<"chipsPulling">
  | { readonly kind: "complete" };

export type Runout = { readonly returnStreet: number; remaining: number };

/** pokerkit's `State` fields, mutated in place on a private copy per action. */
export type HandState = Brandable<"Hand"> & {
  readonly game: Game;
  readonly players: readonly PlayerId[];
  readonly automate: readonly AutomatedStep[];
  readonly antes: readonly Chips[];
  readonly blinds: readonly number[];
  readonly startingStacks: readonly Stack[];
  version: number;
  deck: Card[];
  /** Hashed from the starting deck, so players can't predict a reshuffle. */
  readonly reshuffleSeed: Seed;
  /** pokerkit's `board_cards`: one entry per dealt slot, one card per board. */
  boards: Card[][];
  burned: Card[];
  mucked: Card[];
  /** Per street. */
  discarded: Card[][];
  readonly active: boolean[];
  readonly bets: Chips[];
  readonly stacks: Stack[];
  readonly payoffs: number[];
  readonly hole: HoleCard[][];
  /** What each player held when they folded or mucked, for the record. */
  readonly retired: HoleCard[][];
  street: number | null;
  runout: Runout | null;
  allIn: boolean;
  opener: Position | null;
  runoutCount: number | null;
  runoutCountSelected: boolean;
  /** Frozen once chips pushing begins. */
  pots: PotState[] | null;
  phase: Phase;
  events: readonly HandEvent[];
};

export function stateOf(hand: Hand): HandState {
  // SAFETY: only `handFrom` creates a Hand, from a HandState.
  return hand as HandState;
}

export function handFrom(state: HandState): Hand {
  // SAFETY: HandState carries the optional Hand brand; this grants it.
  return state as Hand;
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

export function positionsOf(state: HandState): Position[] {
  return state.players.map((_, position) => position);
}

export function playerAt(state: HandState, position: Position): PlayerId {
  const player = state.players[position];
  if (player === undefined) throw new Error(`No player at ${position}`);
  return player;
}

export function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`No value at ${index}`);
  return value;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function maxBet(state: HandState): Chips {
  return Math.max(...state.bets);
}

export function activeCount(state: HandState): number {
  return state.active.filter(Boolean).length;
}

/** pokerkit's `rotated`: positions starting from `first`. */
export function rotatedFrom(state: HandState, first: Position): Position[] {
  const positions = positionsOf(state);
  return [...positions.slice(first), ...positions.slice(0, first)];
}

export function streetAt(state: HandState, index: number): Street {
  return at(state.game.rules.streets, index);
}

export function currentStreet(state: HandState): Street {
  if (state.street === null) throw new Error("No street is in progress");
  return streetAt(state, state.street);
}

export function isLastStreet(state: HandState): boolean {
  return state.street === state.game.rules.streets.length - 1;
}

export function laterStreets(state: HandState): readonly Street[] {
  return state.game.rules.streets.slice((state.street ?? -1) + 1);
}

export function upCards(state: HandState, position: Position): Card[] {
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
export function boardCards(state: HandState, board: number): Card[] {
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

function knownCards(cards: readonly Card[]): KnownCard[] {
  return cards.filter(isKnownCard);
}

/** pokerkit's `get_hand`: from every known hole card. */
export function bestHandOf(
  state: HandState,
  position: Position,
  board: number,
  handType: number
): HandValue | null {
  if (!at(state.active, position)) return null;
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
  if (!at(state.active, position)) return null;
  return evaluate(
    at(state.game.rules.handTypes, handType),
    knownCards(upCards(state, position)),
    knownCards(boardCards(state, board))
  );
}

/** pokerkit's `min_or_none`: the first smallest by `key`, skipping nulls. */
export function minOrNull<T>(
  values: readonly (T | null)[],
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
  values: readonly (T | null)[],
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
