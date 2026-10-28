import { isKnownCard, type Card } from "../cards.ts";
import type { EventBody } from "../events.ts";
import type { HoleCard } from "../hand.ts";
import { err, ok, type Result } from "../result.ts";
import type { Face } from "../rules.ts";
import { returnToDeck, takeCards } from "./dealing.ts";
import { potsOf } from "./pots.ts";
import { notEligible, pendingPlayer, type Refusal } from "./refusal.ts";
import {
  activeCount,
  allFaceUp,
  at,
  boardCount,
  bestHandOf,
  isLastStreet,
  laterStreets,
  maxOrNull,
  muck,
  playerAt,
  positionsOf,
  rotatedFrom,
  sum,
  upHandOf,
  type HandState,
  type Position,
} from "./state.ts";

/** Whether some pot is still winnable with every known card the player holds. */
export function canWinNow(state: HandState, position: Position): boolean {
  const pots = potsOf(state).filter((pot) => pot.eligible.includes(position));
  for (let board = 0; board < boardCount(state); board += 1) {
    for (const [handType] of state.game.rules.handTypes.entries()) {
      const hand = bestHandOf(state, position, board, handType);
      if (hand === null) continue;
      for (const pot of pots) {
        const best = maxOrNull(
          pot.eligible.map((index) => upHandOf(state, index, board, handType)),
          (value) => value.strength
        );
        if (best === null || best.strength <= hand.strength) return true;
      }
    }
  }
  return false;
}

export function beginShowdown(state: HandState): void {
  const selecting =
    !state.runoutCountSelected &&
    state.game.mode !== "tournament" &&
    laterStreets(state).some((street) => street.board > 0);
  state.phase = {
    kind: "showdown",
    selectors: positionsOf(state).map(
      (position) => selecting && at(state.active, position)
    ),
    order: rotatedFrom(state, state.opener ?? 0).filter(
      (position) => at(state.active, position) && !allFaceUp(state, position)
    ),
  };
}

export function showdownOver(state: HandState): boolean {
  return (
    state.phase.kind === "showdown" &&
    !state.phase.selectors.some(Boolean) &&
    state.phase.order.length === 0
  );
}

/** Fixes the runouts once; true when the next street is dealt now. */
export function endShowdown(state: HandState): boolean {
  if (!state.runoutCountSelected) {
    state.runoutCountSelected = true;
    if (state.runoutCount !== null && state.street !== null) {
      state.runout = {
        returnStreet: state.street + 1,
        remaining: state.runoutCount - 1,
      };
    }
  }
  return state.allIn && !isLastStreet(state);
}

/** As many runouts as the deck can deal in full, burns included, and at least one. */
export function maxRunouts(state: HandState): number {
  const perRunout = sum(
    laterStreets(state).map(
      (street) =>
        (street.burn ? 1 : 0) +
        street.board * state.game.boards +
        street.hole.length * activeCount(state)
    )
  );
  return Math.max(1, Math.floor(state.deck.length / perRunout));
}

export function selectRunoutCount(
  state: HandState,
  count: number | null,
  player: Position | undefined
): Result<EventBody, Refusal> {
  if (state.phase.kind !== "showdown") return err({ code: "not_now" });
  const { selectors } = state.phase;
  const position = pendingPlayer(state, selectors, player);
  if (!position.ok) return position;
  const maximum = maxRunouts(state);
  if (
    count !== null &&
    (!Number.isSafeInteger(count) || count < 1 || count > maximum)
  ) {
    return err({
      code: "runout_count_out_of_range",
      attempted: count,
      maximum,
    });
  }
  selectors[position.value] = false;
  if (count !== null) {
    state.runoutCount =
      state.runoutCount === null || state.runoutCount === count ? count : 1;
  }
  return ok({
    type: "runoutCountSelected",
    player: playerAt(state, position.value),
    count,
  });
}

export type ShowdownChoice =
  | { readonly kind: "show"; readonly cards: readonly Card[] | undefined }
  | { readonly kind: "muck" }
  | { readonly kind: "default" };

type Reveal = {
  readonly cards: readonly Card[];
  readonly hole: readonly HoleCard[];
};

/** pokerkit pads a partial show with "??" and keeps the rest down mid-hand. */
function reveal(
  state: HandState,
  position: Position,
  shown: readonly Card[]
): Result<Reveal, Refusal> {
  const held = at(state.hole, position).map((hole) => hole.card);
  if (shown.length > held.length) {
    return err({
      code: "wrong_card_count",
      expected: held.length,
      attempted: shown.length,
    });
  }
  const cards = [
    ...shown,
    ...Array.from({ length: held.length - shown.length }, (): Card => "??"),
  ];
  const up: Card[] = cards.filter(isKnownCard);
  const faces: Face[] = up.map(() => "up");
  const kept = isLastStreet(state)
    ? []
    : held.filter((card) => isKnownCard(card) && !up.includes(card));
  const hole = [...up, ...kept].slice(0, held.length);
  while (hole.length < held.length) hole.push("??");
  while (faces.length < held.length) faces.push("down");
  return ok({
    cards,
    hole: hole.map((card, i) => ({ card, face: at(faces, i) })),
  });
}

function shownHole(
  state: HandState,
  position: Position,
  choice: ShowdownChoice
): Result<Reveal | null, Refusal> {
  switch (choice.kind) {
    case "muck":
      return ok(null);
    case "default":
      if (!state.allIn && !canWinNow(state, position)) return ok(null);
      break;
    case "show":
      if (choice.cards !== undefined) {
        return reveal(state, position, choice.cards);
      }
  }
  const hole = at(state.hole, position);
  return ok({
    cards: hole.map((holeCard) => holeCard.card),
    hole: hole.map((holeCard) => ({ card: holeCard.card, face: "up" })),
  });
}

function showdownTurn(
  state: HandState,
  player: Position | undefined
): Result<Position, Refusal> {
  const order = state.phase.kind === "showdown" ? state.phase.order : [];
  if (order.length === 0 && state.street !== null) {
    return err({ code: "not_now" });
  }
  if (player === undefined && state.street === null) {
    return err({ code: "player_required" });
  }
  const position = player ?? at(order, 0);
  if (!at(state.active, position)) {
    return err(
      notEligible(
        state,
        position,
        positionsOf(state).filter((index) => at(state.active, index))
      )
    );
  }
  if (state.street !== null && !order.includes(position)) {
    return err(notEligible(state, position, order));
  }
  return ok(position);
}

export function showOrMuck(
  state: HandState,
  choice: ShowdownChoice,
  player: Position | undefined
): Result<EventBody, Refusal> {
  const turn = showdownTurn(state, player);
  if (!turn.ok) return turn;
  const position = turn.value;
  const shown = shownHole(state, position, choice);
  if (!shown.ok) return shown;
  const held = at(state.hole, position).length;
  if (shown.value !== null) {
    const { cards, hole } = shown.value;
    if (
      state.game.mode === "tournament" &&
      cards.filter(isKnownCard).length < held
    ) {
      return err({ code: "must_show" });
    }
    if (hole.some(({ card, face }) => face === "up" && !isKnownCard(card))) {
      return err({ code: "unknown_card_shown" });
    }
  }
  if (
    state.street === null &&
    (shown.value === null ||
      shown.value.hole.some(({ face }) => face === "down"))
  ) {
    return err({ code: "must_show" });
  }
  if (state.phase.kind === "showdown" && state.street !== null) {
    state.phase.order = state.phase.order.filter((index) => index !== position);
  }
  const id = playerAt(state, position);
  if (shown.value === null) {
    muck(state, position);
    return ok({ type: "mucked", player: id });
  }
  returnToDeck(
    state,
    at(state.hole, position).map((hole) => hole.card)
  );
  takeCards(
    state,
    shown.value.hole.map((hole) => hole.card).filter(isKnownCard)
  );
  state.hole[position] = [...shown.value.hole];
  return ok({ type: "shown", player: id, cards: shown.value.cards });
}

export function beginHandKilling(state: HandState): void {
  state.phase = {
    kind: "handKilling",
    pending: positionsOf(state).map(
      (position) => at(state.active, position) && !canWinNow(state, position)
    ),
  };
}

export function killHand(
  state: HandState,
  player: Position | undefined
): Result<EventBody, Refusal> {
  if (state.phase.kind !== "handKilling") return err({ code: "not_now" });
  const { pending } = state.phase;
  const position = pendingPlayer(state, pending, player);
  if (!position.ok) return position;
  pending[position.value] = false;
  muck(state, position.value);
  return ok({ type: "handKilled", player: playerAt(state, position.value) });
}
