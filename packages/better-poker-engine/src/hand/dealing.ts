import { isKnownCard, shuffle, type Card, type KnownCard } from "../cards.ts";
import type { EventBody } from "../events.ts";
import type { HoleCard } from "../hand.ts";
import { seedFrom, sfc32 } from "../random.ts";
import { err, ok, type Result } from "../result.ts";
import { notEligible, type Refusal } from "./refusal.ts";
import {
  at,
  currentStreet,
  playerAt,
  positionsOf,
  streetAt,
  sum,
  type Dealing,
  type HandState,
  type Position,
} from "./state.ts";

/** Burned, mucked and discarded cards, dealt again once the deck runs out. */
function reserve(state: HandState): KnownCard[] {
  return [state.burned, state.mucked, ...state.discarded]
    .flat()
    .filter(isKnownCard);
}

/** The reserve in the order it is dealt again; a replay deals it the same way. */
function reshuffled(state: HandState): readonly KnownCard[] {
  const cards = reserve(state);
  const key = [...state.reshuffleSeed, ...cards].join(" ");
  return shuffle(cards, sfc32(seedFrom(key)));
}

/** Hole cards that would not fit in the deck go to the board instead. */
export function beginDealing(state: HandState): void {
  state.street = state.street === null ? 0 : state.street + 1;
  const street = currentStreet(state);
  const hole = positionsOf(state).map((position) =>
    at(state.active, position) ? [...street.hole] : []
  );
  const owed = sum(hole.map((faces) => faces.length));
  const fits = owed <= state.deck.length + reserve(state).length;
  state.phase = {
    kind: "dealing",
    burn: street.burn,
    hole: fits ? hole : hole.map(() => []),
    board: Array.from(
      { length: state.game.boards },
      () => street.board + (fits ? 0 : street.hole.length)
    ),
    draw: positionsOf(state).map(
      (position) => at(state.active, position) && street.draw
    ),
  };
}

function dealing(state: HandState): Dealing | null {
  return state.phase.kind === "dealing" ? state.phase : null;
}

function holePending(phase: Dealing): boolean {
  return phase.hole.some((faces) => faces.length > 0);
}

function boardPending(phase: Dealing): boolean {
  return phase.board.some((count) => count > 0);
}

function drawPending(phase: Dealing): boolean {
  return phase.draw.some(Boolean);
}

export function canBurn(phase: Dealing): boolean {
  return (
    phase.burn &&
    !(holePending(phase) && boardPending(phase)) &&
    !drawPending(phase)
  );
}

export function canDealHole(phase: Dealing): boolean {
  return (
    !(phase.burn && !boardPending(phase)) &&
    holePending(phase) &&
    !drawPending(phase)
  );
}

export function canDealBoard(phase: Dealing): boolean {
  return !phase.burn && boardPending(phase) && !drawPending(phase);
}

/** pokerkit's `get_dealable_cards`: the deck, then the reserve if it runs short. */
function fromDeck(state: HandState, count: number): Result<Card[], Refusal> {
  const dealable =
    count > state.deck.length
      ? [...state.deck, ...reshuffled(state)]
      : state.deck;
  if (dealable.length < count) {
    return err({
      code: "not_enough_cards",
      needed: count,
      available: dealable.length,
    });
  }
  return ok(dealable.slice(0, count));
}

function removeFirst(cards: Card[], card: Card): void {
  const index = cards.indexOf(card);
  if (index !== -1) cards.splice(index, 1);
}

/** pokerkit's `_produce_cards`: known cards back into the deck, once each. */
export function returnToDeck(state: HandState, cards: readonly Card[]): void {
  for (const card of cards) {
    if (isKnownCard(card) && !state.deck.includes(card)) state.deck.push(card);
  }
}

/** pokerkit's `_consume_cards`: cards dealt from outside the deck are allowed. */
export function takeCards(state: HandState, cards: readonly Card[]): void {
  const deck = new Set(state.deck);
  const dealt = new Set(cards);
  if (dealt.size > deck.size && [...deck].every((card) => dealt.has(card))) {
    returnToDeck(state, reshuffled(state));
    state.burned = [];
    state.mucked = [];
    state.discarded = state.discarded.map(() => []);
  }
  for (const card of cards) {
    removeFirst(state.deck, card);
    removeFirst(state.burned, card);
    removeFirst(state.mucked, card);
    for (const discarded of state.discarded) removeFirst(discarded, card);
  }
}

export function burnCard(
  state: HandState,
  card: Card | undefined
): Result<EventBody, Refusal> {
  const phase = dealing(state);
  if (phase === null || !canBurn(phase)) return err({ code: "not_now" });
  const cards = card === undefined ? fromDeck(state, 1) : ok([card]);
  if (!cards.ok) return cards;
  const burned = at(cards.value, 0);
  takeCards(state, cards.value);
  phase.burn = false;
  state.burned.push(burned);
  return ok({ type: "cardBurned", card: burned });
}

/** Most cards owed first, then position; on draw streets, the first owed. */
function nextDealee(state: HandState, phase: Dealing): Position {
  if (currentStreet(state).hole.length === 0) {
    return phase.hole.findIndex((faces) => faces.length > 0);
  }
  let dealee = 0;
  for (const [position, faces] of phase.hole.entries()) {
    if (faces.length > at(phase.hole, dealee).length) dealee = position;
  }
  return dealee;
}

export function holeDealee(state: HandState): Position | null {
  const phase = dealing(state);
  if (phase === null || !canDealHole(phase)) return null;
  return nextDealee(state, phase);
}

export function dealHole(
  state: HandState,
  cards: readonly Card[] | undefined,
  player: Position | undefined
): Result<EventBody, Refusal> {
  const phase = dealing(state);
  if (phase === null || !canDealHole(phase)) return err({ code: "not_now" });
  const dealt = cards === undefined ? fromDeck(state, 1) : ok(cards);
  if (!dealt.ok) return dealt;
  const dealee = player ?? nextDealee(state, phase);
  const owed = at(phase.hole, dealee);
  if (owed.length === 0) {
    return err(
      notEligible(
        state,
        dealee,
        positionsOf(state).filter(
          (position) => at(phase.hole, position).length > 0
        )
      )
    );
  }
  if (dealt.value.length === 0 || dealt.value.length > owed.length) {
    return err({
      code: "wrong_card_count",
      expected: owed.length,
      attempted: dealt.value.length,
    });
  }
  takeCards(state, dealt.value);
  const holeCards: HoleCard[] = dealt.value.map((card) => ({
    card,
    face: owed.shift() ?? "down",
  }));
  at(state.hole, dealee).push(...holeCards);
  return ok({
    type: "holeDealt",
    player: playerAt(state, dealee),
    cards: holeCards,
  });
}

/** The board the next board card goes to, and how many it is owed. */
export function nextBoard(
  state: HandState
): { readonly board: number; readonly cards: number } | null {
  const phase = dealing(state);
  if (phase === null || !canDealBoard(phase)) return null;
  const cards = phase.board.find((count) => count > 0) ?? 0;
  return {
    board: state.boards[firstSlot(state, cards)]?.length ?? 0,
    cards,
  };
}

function firstSlot(state: HandState, owed: number): number {
  const street = currentStreet(state);
  let slot = Math.max(street.board - owed, 0);
  for (let index = 0; index < (state.street ?? 0); index += 1) {
    slot += streetAt(state, index).board;
  }
  return slot;
}

export function dealBoard(
  state: HandState,
  cards: readonly Card[] | undefined
): Result<EventBody, Refusal> {
  const phase = dealing(state);
  if (phase === null || !canDealBoard(phase)) return err({ code: "not_now" });
  const owed = phase.board.find((count) => count > 0) ?? 0;
  const dealt = cards === undefined ? fromDeck(state, owed) : ok(cards);
  if (!dealt.ok) return dealt;
  if (dealt.value.length === 0 || dealt.value.length > owed) {
    return err({
      code: "wrong_card_count",
      expected: owed,
      attempted: dealt.value.length,
    });
  }
  takeCards(state, dealt.value);
  const first = firstSlot(state, owed);
  const board = state.boards[first]?.length ?? 0;
  phase.board[phase.board.indexOf(owed)] = owed - dealt.value.length;
  for (const [offset, card] of dealt.value.entries()) {
    const slot = first + offset;
    while (state.boards.length <= slot) state.boards.push([]);
    at(state.boards, slot).push(card);
  }
  return ok({ type: "boardDealt", board, cards: dealt.value });
}

export function drawer(state: HandState): Position | null {
  const phase = dealing(state);
  if (phase === null) return null;
  const position = phase.draw.indexOf(true);
  return position === -1 ? null : position;
}

export function draw(
  state: HandState,
  discard: readonly Card[],
  player: Position | undefined
): Result<EventBody, Refusal> {
  const phase = dealing(state);
  const position = drawer(state);
  if (phase === null || position === null) return err({ code: "not_now" });
  if (player !== undefined && player !== position) {
    return err(notEligible(state, player, [position]));
  }
  const held = at(state.hole, position).map((hole) => hole.card);
  for (const card of discard) {
    const index = held.indexOf(card);
    if (index === -1) return err({ code: "card_not_held", card });
    held.splice(index, 1);
  }
  phase.draw[position] = false;
  const hole = at(state.hole, position);
  const discarded = at(state.discarded, state.street ?? 0);
  for (const card of discard) {
    const index = hole.findIndex((holeCard) => holeCard.card === card);
    at(phase.hole, position).push(at(hole, index).face);
    hole.splice(index, 1);
    discarded.push(card);
  }
  return ok({
    type: "drew",
    player: playerAt(state, position),
    discarded: discard,
  });
}
