import { addToStack, capAt, takeFromStack, type Chips } from "../chips.ts";
import type { EventBody, PlayerAmount } from "../events.ts";
import { err, ok, type Result } from "../result.ts";
import { pendingPlayer, type Refusal } from "./refusal.ts";
import {
  activeCount,
  at,
  playerAt,
  positionsOf,
  type HandState,
  type Position,
} from "./state.ts";

/** pokerkit swaps forced bets heads-up, so position 0 posts the big blind. */
function headsUpSwapped(state: HandState, position: Position): Position {
  return state.players.length === 2 ? 1 - position : position;
}

export function effectiveAnte(state: HandState, position: Position): Chips {
  return capAt(
    at(state.antes, headsUpSwapped(state, position)),
    at(state.startingStacks, position)
  );
}

export function effectiveBlind(state: HandState, position: Position): Chips {
  return capAt(
    Math.abs(at(state.blinds, headsUpSwapped(state, position))),
    takeFromStack(
      at(state.startingStacks, position),
      effectiveAnte(state, position)
    )
  );
}

export function beginAntePosting(state: HandState): void {
  state.phase = {
    kind: "antePosting",
    pending: positionsOf(state).map(
      (position) => effectiveAnte(state, position) > 0
    ),
  };
}

export function beginBlindPosting(state: HandState): void {
  state.phase = {
    kind: "blindPosting",
    pending: positionsOf(state).map(
      (position) => effectiveBlind(state, position) > 0
    ),
  };
}

export function placeBet(
  state: HandState,
  position: Position,
  amount: Chips
): void {
  state.bets[position] = at(state.bets, position) + amount;
  state.stacks[position] = takeFromStack(at(state.stacks, position), amount);
  state.payoffs[position] = at(state.payoffs, position) - amount;
}

export function postAnte(
  state: HandState,
  player: Position | undefined
): Result<EventBody, Refusal> {
  if (state.phase.kind !== "antePosting") return err({ code: "not_now" });
  const { pending } = state.phase;
  const position = pendingPlayer(state, pending, player);
  if (!position.ok) return position;
  const amount = effectiveAnte(state, position.value);
  pending[position.value] = false;
  placeBet(state, position.value, amount);
  return ok({
    type: "antePosted",
    player: playerAt(state, position.value),
    amount,
  });
}

export function postBlind(
  state: HandState,
  player: Position | undefined
): Result<EventBody, Refusal> {
  if (state.phase.kind !== "blindPosting") return err({ code: "not_now" });
  const { pending } = state.phase;
  const position = pendingPlayer(state, pending, player);
  if (!position.ok) return position;
  const amount = effectiveBlind(state, position.value);
  pending[position.value] = false;
  placeBet(state, position.value, amount);
  return ok({
    type: "blindPosted",
    player: playerAt(state, position.value),
    amount,
  });
}

export function beginBetCollection(state: HandState): void {
  state.phase = {
    kind: "betCollection",
    pending: state.bets.some((bet) => bet > 0),
  };
}

/** A lone player left keeps their bet; it goes back to them with the pot. */
export function collectBets(state: HandState): Result<EventBody, Refusal> {
  if (state.phase.kind !== "betCollection" || !state.phase.pending) {
    return err({ code: "not_now" });
  }
  state.phase.pending = false;
  const lone = activeCount(state) === 1;
  const collectors = positionsOf(state).filter(
    (position) => !lone || !at(state.active, position)
  );
  const returned: PlayerAmount[] = [];
  if (state.street !== null || state.game.forcedBets.anteTrimming) {
    const cutoff = at(
      state.bets.toSorted((a, b) => a - b),
      state.players.length - 2
    );
    for (const position of collectors) {
      const over = at(state.bets, position) - cutoff;
      if (over <= 0) continue;
      state.bets[position] = cutoff;
      state.stacks[position] = addToStack(at(state.stacks, position), over);
      state.payoffs[position] = at(state.payoffs, position) + over;
      returned.push({ player: playerAt(state, position), amount: over });
    }
  }
  let collected = 0;
  for (const position of collectors) {
    collected += at(state.bets, position);
    state.bets[position] = 0;
  }
  return ok({ type: "betsCollected", collected, returned });
}
