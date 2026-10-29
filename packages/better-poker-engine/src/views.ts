import type { Card, Deck } from "./cards.ts";
import type { Chips, Stack } from "./chips.ts";
import type { HandValue } from "./evaluation.ts";
import type { Cause, EventBody, HandEvent } from "./events.ts";
import type { Decision, Hand, HoleCard, PlayerId } from "./hand.ts";
import { effectiveStack } from "./hand/betting.ts";
import { decisionOf, potView } from "./hand/flow.ts";
import { potsOf, totalPot } from "./hand/pots.ts";
import { canWinNow } from "./hand/showdown.ts";
import {
  at,
  boardCards,
  boardCount,
  bestHandOf,
  playerAt,
  positionsOf,
  stateOf,
  upHandOf,
} from "./hand/state.ts";

export type Audience =
  | { readonly kind: "player"; readonly player: PlayerId }
  | { readonly kind: "spectator" }
  | { readonly kind: "auditor" };

export type Pot = {
  readonly amount: Chips;
  readonly raked: Chips;
  /** Empty when nobody can claim it. */
  readonly eligible: readonly PlayerId[];
};

export type PlayerView = {
  readonly player: PlayerId;
  readonly position: number;
  readonly startingStack: Stack;
  readonly stack: Stack;
  readonly bet: Chips;
  /** Out of the hand: folded, mucked, or killed. */
  readonly folded: boolean;
  /** Cards this audience may not see read "??". */
  readonly holeCards: readonly HoleCard[];
  readonly effectiveStack: Stack;
  /** By board, then hand type: the best hand from the cards this audience sees. */
  readonly hands: readonly (readonly (HandValue | null)[])[];
  /** pokerkit's `can_win_now`: a pot share is winnable against the cards shown. False
   * until bets reach a pot; null when this audience cannot see the hole cards. */
  readonly canWinNow: boolean | null;
};

export type DealerView = {
  readonly deck: Deck;
  readonly burned: readonly Card[];
  readonly mucked: readonly Card[];
};

export type HandView = {
  readonly audience: Audience;
  readonly version: number;
  readonly street: number | null;
  /** Position order. */
  readonly players: readonly PlayerView[];
  readonly boards: readonly (readonly Card[])[];
  readonly pots: readonly Pot[];
  /** Pots plus bets not yet collected. */
  readonly totalPot: Chips;
  readonly decision: Decision;
  /** Auditors only. */
  readonly dealer: DealerView | null;
};

function seesHoleCards(audience: Audience, player: PlayerId): boolean {
  return (
    audience.kind === "auditor" ||
    (audience.kind === "player" && audience.player === player)
  );
}

function hidden(cards: readonly HoleCard[]): HoleCard[] {
  return cards.map((hole) =>
    hole.face === "up" ? hole : { card: "??", face: hole.face }
  );
}

export function viewHand(hand: Hand, audience: Audience): HandView {
  const state = stateOf(hand);
  const boards = Array.from({ length: boardCount(state) }, (_, board) =>
    boardCards(state, board)
  );
  const players = positionsOf(state).map((position): PlayerView => {
    const player = playerAt(state, position);
    const sees = seesHoleCards(audience, player);
    const hole = at(state.hole, position);
    return {
      player,
      position,
      startingStack: at(state.startingStacks, position),
      stack: at(state.stacks, position),
      bet: at(state.bets, position),
      folded: !at(state.active, position),
      holeCards: sees ? [...hole] : hidden(hole),
      effectiveStack: effectiveStack(state, position),
      hands: boards.map((_, board) =>
        state.game.rules.handTypes.map((_, handType) =>
          sees
            ? bestHandOf(state, position, board, handType)
            : upHandOf(state, position, board, handType)
        )
      ),
      canWinNow: sees ? canWinNow(state, position) : null,
    };
  });
  return {
    audience,
    version: state.version,
    street: state.street,
    players,
    boards,
    pots: potsOf(state).map((pot) => potView(state, pot)),
    totalPot: totalPot(state),
    decision: decisionOf(state),
    dealer:
      audience.kind === "auditor"
        ? {
            deck: [...state.deck],
            burned: [...state.burned],
            mucked: [...state.mucked],
          }
        : null,
  };
}

declare const redacted: unique symbol;
type Redacted = { readonly [redacted]: true };

/** Same structure as a raw event, so only the brand tells a redacted one apart. */
export type HandEventView = HandEvent & Redacted;

function redactBody(body: EventBody, audience: Audience): EventBody {
  switch (body.type) {
    case "holeDealt":
      return seesHoleCards(audience, body.player)
        ? body
        : { ...body, cards: hidden(body.cards) };
    case "cardBurned":
      return audience.kind === "auditor" ? body : { ...body, card: "??" };
    case "drew":
      return seesHoleCards(audience, body.player)
        ? body
        : { ...body, discarded: body.discarded.map((): Card => "??") };
    default:
      return body;
  }
}

/** The action that caused an event repeats its cards; they follow the body. */
function redactCause(cause: Cause, body: EventBody): Cause {
  if (cause.kind !== "action") return cause;
  const { action } = cause;
  switch (action.type) {
    case "dealHole":
      if (body.type !== "holeDealt" || action.cards === undefined) return cause;
      return {
        kind: "action",
        action: { ...action, cards: body.cards.map((hole) => hole.card) },
      };
    case "burnCard":
      if (body.type !== "cardBurned" || action.card === undefined) return cause;
      return { kind: "action", action: { ...action, card: body.card } };
    case "draw":
      if (body.type !== "drew") return cause;
      return { kind: "action", action: { ...action, discard: body.discarded } };
    default:
      return cause;
  }
}

/** Replaces cards the audience may not see with "??". */
export function eventsFor(
  events: readonly HandEvent[],
  audience: Audience
): readonly HandEventView[] {
  return events.map((event) => {
    const body = redactBody(event.body, audience);
    const view = { ...event, body, cause: redactCause(event.cause, body) };
    // SAFETY: redactBody and redactCause replaced every card this audience may not see.
    return view as HandEventView;
  });
}
