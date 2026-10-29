import { expect } from "bun:test";

import type { Example } from "../../../parity/harness.ts";
import { decks, type Card, type Deck } from "../src/cards.ts";
import type { Stack } from "../src/chips.ts";
import type { EventBody, HandEvent } from "../src/events.ts";
import {
  act,
  automation,
  startHand,
  type Action,
  type AutomatedStep,
  type Automation,
  type Hand,
  type PlayerId,
  type Violation,
} from "../src/hand.ts";
import type { Game } from "../src/rules.ts";
import { viewHand, type HandView } from "../src/views.ts";
import { cards } from "./support.ts";

export function allBut(...manual: readonly AutomatedStep[]): Automation {
  return automation.all.filter((step) => !manual.includes(step));
}

export function start(
  game: Game,
  stacks: readonly Stack[],
  automate: Automation,
  deck: Deck = decks[game.rules.deck]
): Hand {
  const started = startHand({ game, stacks, deck, automate });
  if (!started.ok) {
    throw new Error(`Setup rejected: ${JSON.stringify(started.error)}`);
  }
  return started.value.hand;
}

/** A hand that moves forward with each accepted action, as a pokerkit `State` does. */
export type Driver = {
  hand: Hand;
  /** The event of an action that must be accepted. */
  readonly act: (action: Action) => EventBody;
  /** The violation of an action that must be rejected; the hand stays put. */
  readonly reject: (action: Action) => Violation;
  /** pokerkit's `can_*`: whether the action would be accepted. */
  readonly can: (action: Action) => boolean;
  /** Events after `act`, automation included. */
  readonly events: () => readonly HandEvent[];
};

export function drive(hand: Hand): Driver {
  let events: readonly HandEvent[] = [];
  const driver: Driver = {
    hand,
    act: (action) => {
      const result = act(driver.hand, action);
      if (!result.ok) {
        throw new Error(
          `${action.type} rejected: ${JSON.stringify(result.error)}`
        );
      }
      driver.hand = result.value.hand;
      events = result.value.events;
      const first = events[0];
      if (first === undefined) throw new Error("An action without an event");
      return first.body;
    },
    reject: (action) => {
      const result = act(driver.hand, action);
      if (result.ok) throw new Error(`${action.type} was accepted`);
      return result.error;
    },
    can: (action) => act(driver.hand, action).ok,
    events: () => events,
  };
  return driver;
}

export const checkOrCall = { type: "checkOrCall" } as const;

export function checked(player: PlayerId): EventBody {
  return { type: "checked", player };
}

export function called(player: PlayerId, amount: number): EventBody {
  return { type: "called", player, amount, allIn: false };
}

export function burn(card: Card): Action {
  return { type: "burnCard", card };
}

export function burned(card: Card): EventBody {
  return { type: "cardBurned", card };
}

export function dealBoard(text: string): Action {
  return { type: "dealBoard", cards: cards(text) };
}

export function boardDealt(text: string, board = 0): EventBody {
  return { type: "boardDealt", board, cards: cards(text) };
}

export function dealHole(text: string): Action {
  return { type: "dealHole", cards: cards(text) };
}

/** Faces default to all down; stud deals some up. */
export function holeDealt(
  player: PlayerId,
  text: string,
  faces: readonly ("down" | "up")[] = []
): EventBody {
  return {
    type: "holeDealt",
    player,
    cards: cards(text).map((card, index) => ({
      card,
      face: faces[index] ?? "down",
    })),
  };
}

export type Step = readonly [
  index: number,
  action: Action | "minimumRaise",
  body: EventBody,
];

/** One example per step: the action is accepted with exactly this event. */
export function steps(
  example: Example,
  table: () => Driver,
  list: readonly Step[]
): void {
  for (const [index, action, body] of list) {
    example(index, () => {
      const driver = table();
      const attempted =
        action === "minimumRaise" ? minimumRaise(driver) : action;
      expect(driver.act(attempted)).toEqual(body);
    });
  }
}

/** One pokerkit call in a unit test script. */
export type Move = (table: Driver) => void;

export function play(table: Driver, moves: readonly Move[]): void {
  for (const move of moves) move(table);
}

export function accept(action: Action): Move {
  return (table) => {
    table.act(action);
  };
}

/** pokerkit's argument-free completion, bet or raise: the minimum. */
export function minimumRaise(table: Driver): Action {
  const decision = auditor(table.hand).decision;
  const range = decision.kind === "betting" ? decision.betOrRaiseTo : null;
  return { type: "betOrRaiseTo", amount: range?.min ?? 0 };
}

export const moves = {
  deal: (text: string) => accept(dealHole(text)),
  board: (text: string) => accept(dealBoard(text)),
  burn: accept(burn("??")),
  call: accept(checkOrCall),
  fold: accept({ type: "fold" }),
  bringIn: accept({ type: "postBringIn" }),
  raiseTo: (amount: number) => accept({ type: "betOrRaiseTo", amount }),
  raise: ((table) => {
    table.act(minimumRaise(table));
  }) satisfies Move,
  standPat: accept({ type: "draw", discard: [] }),
  /** pokerkit's `stand_pat_or_discard(state.hole_cards[i])`. */
  discardHeld:
    (position: number): Move =>
    (table) => {
      const held = auditor(table.hand).players[position]?.holeCards ?? [];
      table.act({ type: "draw", discard: held.map((hole) => hole.card) });
    },
  /** A pokerkit ValueError: the action is refused with this violation. */
  refuse:
    (action: Action | "minimumRaise", violation: Violation): Move =>
    (table) => {
      const attempted =
        action === "minimumRaise" ? minimumRaise(table) : action;
      expect(table.reject(attempted)).toEqual(violation);
    },
};

export function auditor(hand: Hand): HandView {
  return viewHand(hand, { kind: "auditor" });
}

export function spectator(hand: Hand): HandView {
  return viewHand(hand, { kind: "spectator" });
}

/** Who the dealer still has to act for, when this is the step being waited for. */
export function pending(
  hand: Hand,
  step: "antePosting" | "blindPosting" | "handKilling" | "chipsPulling"
): PlayerId[] {
  const decision = auditor(hand).decision;
  if (decision.kind !== "dealer") return [];
  switch (decision.step) {
    case "antePosting":
    case "blindPosting":
    case "handKilling":
    case "chipsPulling":
      return decision.step === step ? [...decision.players] : [];
    default:
      return [];
  }
}

export function stacks(hand: Hand): Stack[] {
  return auditor(hand).players.map((player) => player.stack);
}

export function bets(hand: Hand): number[] {
  return auditor(hand).players.map((player) => player.bet);
}

/** pokerkit's `status`: whether the hand is still in progress. */
export function inProgress(hand: Hand): boolean {
  return auditor(hand).decision.kind !== "complete";
}

export function totalPot(hand: Hand): number {
  return auditor(hand).totalPot;
}

/** pokerkit's `pot_amounts`: unraked, main pot first. */
export function potAmounts(hand: Hand): number[] {
  return auditor(hand).pots.map((pot) => pot.amount - pot.raked);
}

export function holeCards(
  view: HandView,
  position: number,
  face: "down" | "up"
): Card[] {
  const player = view.players[position];
  if (player === undefined) throw new Error(`No position ${position}`);
  return player.holeCards
    .filter((hole) => hole.face === face)
    .map((hole) => hole.card);
}

export function repeat<T>(value: T, count: number): T[] {
  return Array.from({ length: count }, () => value);
}

/** pokerkit's player index `i` is position `i`, named "p{i + 1}". */
export function seat(position: number): PlayerId {
  return `p${position + 1}`;
}
