import {
  isKnownCard,
  rankOf,
  rankOrders,
  suitOf,
  suitSymbols,
  type Card,
  type KnownCard,
} from "../cards.ts";
import {
  addToStack,
  capAt,
  compareStacks,
  exceeds,
  minStack,
  takeFromStack,
  type Chips,
  type Stack,
} from "../chips.ts";
import type { EventBody } from "../events.ts";
import type { RaiseRange } from "../hand.ts";
import { entryOf, lookup, type Entry } from "../lookups.ts";
import { err, ok, type Result } from "../result.ts";
import type { Opening } from "../rules.ts";
import { placeBet } from "./forced.ts";
import { notEligible, type Refusal } from "./refusal.ts";
import {
  activeCount,
  at,
  currentStreet,
  isLastStreet,
  laterStreets,
  maxBet,
  maxOrNull,
  minOrNull,
  muck,
  playerAt,
  positionsOf,
  rotatedFrom,
  sum,
  upCards,
  type Betting,
  type HandState,
  type Position,
} from "./state.ts";
import { totalPot } from "./pots.ts";

/** What the player can lose: capped by the second-largest active stack. */
export function effectiveStack(state: HandState, position: Position): Stack {
  if (state.street === null || !at(state.active, position)) return 0;
  const totals = positionsOf(state)
    .filter((index) => at(state.active, index))
    .map((index) => addToStack(at(state.stacks, index), at(state.bets, index)))
    .toSorted(compareStacks);
  const second = totals.at(-2);
  if (second === undefined) return 0;
  const covered = takeFromStack(second, at(state.bets, position));
  return minStack(
    at(state.stacks, position),
    covered === "unbounded" ? covered : Math.max(0, covered)
  );
}

/** pokerkit's `card_key`: rank in `order`, then suit, clubs lowest. */
function cardKey(order: readonly string[]): (card: KnownCard) => number {
  return (card) =>
    order.indexOf(rankOf(card)) * suitSymbols.length +
    suitSymbols.indexOf(suitOf(card));
}

function knownUpCards(state: HandState, position: Position): KnownCard[] {
  return upCards(state, position).filter(isKnownCard);
}

function openingEntry(
  state: HandState,
  position: Position,
  low: boolean
): Entry | null {
  const table = lookup(low ? "lowHandOpening" : "highHandOpening");
  const cards: readonly Card[] = upCards(state, position);
  return entryOf(table, cards);
}

/** pokerkit's `_begin_betting` opener, ties going to the earlier position. */
function openerOf(state: HandState, opening: Opening): Position {
  const positions = positionsOf(state);
  switch (opening) {
    case "position": {
      const blinds =
        state.players.length === 2 ? state.blinds.toReversed() : state.blinds;
      let last = 0;
      let largest = -Infinity;
      for (const position of positions) {
        const bet = at(state.bets, position) * Math.sign(at(blinds, position));
        if (bet >= largest) {
          largest = bet;
          last = position;
        }
      }
      return (last + 1) % state.players.length;
    }
    case "lowCard": {
      const key = cardKey(rankOrders.standard);
      const lowest = positions.map((position) =>
        minOrNull(knownUpCards(state, position), key)
      );
      return lowest.indexOf(minOrNull(lowest, key));
    }
    case "highCard": {
      const key = cardKey(rankOrders.regular);
      const highest = positions.map((position) =>
        maxOrNull(knownUpCards(state, position), key)
      );
      return highest.indexOf(maxOrNull(highest, key));
    }
    case "lowHand":
    case "highHand": {
      const low = opening === "lowHand";
      const entries = positions.map((position) =>
        openingEntry(state, position, low)
      );
      const index = (entry: Entry) => entry.index;
      const best = low ? minOrNull(entries, index) : maxOrNull(entries, index);
      return entries.findIndex((entry) => entry?.index === best?.index);
    }
  }
}

export function beginBetting(state: HandState): void {
  const street = currentStreet(state);
  const opener = openerOf(state, street.opening);
  state.opener = opener;
  const bringIn =
    state.street === 0 && (state.game.forcedBets.bringIn ?? 0) > 0;
  const actors = rotatedFrom(state, opener).filter(
    (position) =>
      at(state.active, position) &&
      at(state.stacks, position) !== 0 &&
      effectiveStack(state, position) !== 0
  );
  const lone =
    actors.length === 1 && at(state.bets, at(actors, 0)) >= maxBet(state);
  state.phase = {
    kind: "betting",
    bringIn,
    completion: bringIn,
    actors: lone ? [] : actors,
    lastRaise: 0,
    raises: 0,
    acted: [],
    shortAllIns: [],
  };
}

export function bettingOver(state: HandState): boolean {
  return (
    state.phase.kind === "betting" &&
    (state.phase.actors.length === 0 || activeCount(state) <= 1)
  );
}

/** Whether the hand is all-in, which turns the rest into a runout. */
export function endBetting(state: HandState): void {
  if (state.phase.kind === "betting") state.phase.actors = [];
  if (
    activeCount(state) > 1 &&
    !laterStreets(state).some((street) => street.draw)
  ) {
    const withChips = positionsOf(state).filter(
      (position) =>
        at(state.active, position) && at(state.stacks, position) !== 0
    );
    if (withChips.length <= 1) state.allIn = true;
  }
  if (state.stacks.includes(0) && isLastStreet(state)) state.allIn = true;
}

type Turn = { readonly phase: Betting; readonly actor: Position };

function turnOf(
  state: HandState,
  player: Position | undefined
): Result<Turn, Refusal> {
  const { phase } = state;
  if (phase.kind !== "betting") return err({ code: "not_now" });
  const actor = phase.actors[0];
  if (actor === undefined) return err({ code: "not_now" });
  if (player !== undefined && player !== actor) {
    return err(notEligible(state, player, [actor]));
  }
  return ok({ phase, actor });
}

function popActor(phase: Betting): Position {
  const actor = at(phase.actors, 0);
  phase.actors.shift();
  if (!phase.acted.includes(actor)) phase.acted.push(actor);
  return actor;
}

export function fold(
  state: HandState,
  player: Position | undefined
): Result<EventBody, Refusal> {
  const turn = turnOf(state, player);
  if (!turn.ok) return turn;
  const { phase, actor } = turn.value;
  if (phase.bringIn) return err({ code: "bring_in_pending" });
  const needless = at(state.bets, actor) >= maxBet(state);
  if (needless && state.game.mode === "tournament") {
    return err({ code: "needless_fold" });
  }
  popActor(phase);
  muck(state, actor);
  return ok({ type: "folded", player: playerAt(state, actor), needless });
}

export function callAmount(state: HandState, actor: Position): Chips {
  return capAt(maxBet(state) - at(state.bets, actor), at(state.stacks, actor));
}

export function checkOrCall(
  state: HandState,
  player: Position | undefined
): Result<EventBody, Refusal> {
  const turn = turnOf(state, player);
  if (!turn.ok) return turn;
  const { phase, actor } = turn.value;
  if (phase.bringIn) return err({ code: "bring_in_pending" });
  const amount = callAmount(state, actor);
  popActor(phase);
  placeBet(state, actor, amount);
  const id = playerAt(state, actor);
  if (amount === 0) return ok({ type: "checked", player: id });
  return ok({
    type: "called",
    player: id,
    amount,
    allIn: at(state.stacks, actor) === 0,
  });
}

export function bringInAmount(state: HandState, actor: Position): Chips {
  return capAt(state.game.forcedBets.bringIn ?? 0, at(state.stacks, actor));
}

export function postBringIn(
  state: HandState,
  player: Position | undefined
): Result<EventBody, Refusal> {
  const turn = turnOf(state, player);
  if (!turn.ok) return turn;
  const { phase, actor } = turn.value;
  if (!phase.bringIn) return err({ code: "not_now" });
  const amount = bringInAmount(state, actor);
  popActor(phase);
  placeBet(state, actor, amount);
  phase.bringIn = false;
  return ok({
    type: "bringInPosted",
    player: playerAt(state, actor),
    amount,
  });
}

function shortOfReopening(state: HandState, amount: Chips, phase: Betting) {
  const doubled =
    state.game.rules.structure === "fixedLimit" ? 2 * amount : amount;
  return doubled < phase.lastRaise;
}

function raiseKind(phase: Betting, largest: Chips): RaiseRange["kind"] {
  if (phase.completion) return "complete";
  return largest === 0 ? "bet" : "raise";
}

/** pokerkit's `_verify_completion_betting_or_raising` and amount bounds. */
export function raiseRange(
  state: HandState,
  player: Position | undefined
): Result<RaiseRange, Refusal> {
  const turn = turnOf(state, player);
  if (!turn.ok) return turn;
  const { phase, actor } = turn.value;
  const street = currentStreet(state);
  const stack = at(state.stacks, actor);
  const bet = at(state.bets, actor);
  const largest = maxBet(state);
  // pokerkit checks this last and reports a stack that only covers a call as a short all-in.
  if (!exceeds(stack, largest - bet)) return err({ code: "call_is_all_in" });
  if (
    !phase.bringIn &&
    shortOfReopening(state, callAmount(state, actor), phase)
  ) {
    return err({ code: "action_not_reopened" });
  }
  if (phase.raises === street.maxBetsAndRaises) {
    return err({ code: "betting_capped", limit: phase.raises });
  }
  if (
    phase.shortAllIns.length > 0 &&
    shortOfReopening(state, sum(phase.shortAllIns), phase) &&
    phase.acted.includes(actor)
  ) {
    return err({ code: "action_not_reopened" });
  }
  const contested = positionsOf(state).some(
    (position) =>
      position !== actor &&
      at(state.active, position) &&
      exceeds(
        addToStack(at(state.stacks, position), at(state.bets, position)),
        largest
      )
  );
  if (!contested) return err({ code: "everyone_else_all_in" });
  const all = addToStack(stack, bet);
  const min = capAt(
    Math.max(phase.lastRaise, street.minCompletionBetOrRaise) +
      (phase.completion ? 0 : largest),
    all
  );
  const pot = capAt(Math.max(min, 2 * largest - bet + totalPot(state)), all);
  const kind = raiseKind(phase, largest);
  switch (state.game.rules.structure) {
    case "fixedLimit":
      return ok({ kind, min, max: min });
    case "potLimit":
      return ok({ kind, min, max: pot });
    case "noLimit":
      return ok({ kind, min, max: all });
  }
}

export function betOrRaiseTo(
  state: HandState,
  amount: Chips,
  player: Position | undefined
): Result<EventBody, Refusal> {
  const range = raiseRange(state, player);
  if (!range.ok) return range;
  const { kind, min, max } = range.value;
  if (amount < min) {
    return err({ code: "below_minimum", attempted: amount, minimum: min });
  }
  if (max !== "unbounded" && amount > max) {
    return err({ code: "above_maximum", attempted: amount, maximum: max });
  }
  if (!Number.isSafeInteger(amount)) {
    return err({ code: "invalid_amount", attempted: amount });
  }
  if (state.phase.kind !== "betting") return err({ code: "not_now" });
  const phase = state.phase;
  const actor = popActor(phase);
  const raise = amount - maxBet(state);
  placeBet(state, actor, amount - at(state.bets, actor));
  phase.bringIn = false;
  phase.completion = false;
  phase.actors = rotatedFrom(state, actor)
    .slice(1)
    .filter(
      (position) =>
        at(state.active, position) && at(state.stacks, position) !== 0
    );
  state.opener = actor;
  if (raise >= phase.lastRaise) phase.acted = [actor];
  phase.lastRaise = Math.max(phase.lastRaise, raise);
  phase.raises += 1;
  const allIn = at(state.stacks, actor) === 0;
  phase.shortAllIns = allIn ? [...phase.shortAllIns, raise] : [];
  if (sum(phase.shortAllIns) >= phase.lastRaise) phase.shortAllIns = [];
  return ok({
    type: "betOrRaised",
    player: playerAt(state, actor),
    kind,
    to: amount,
    allIn,
  });
}
