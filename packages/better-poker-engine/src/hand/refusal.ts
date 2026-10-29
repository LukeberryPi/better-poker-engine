import type { Violation } from "../hand.ts";
import { err, ok, type Result } from "../result.ts";
import {
  playerAt,
  positionsOf,
  type HandState,
  type Position,
} from "./state.ts";

/** A violation before `act` knows which action and decision to name in `not_now`. */
export type Refusal =
  | Exclude<Violation, { readonly code: "not_now" }>
  | { readonly code: "not_now" };

export function notEligible(
  state: HandState,
  position: Position,
  eligible: readonly Position[]
): Refusal {
  return {
    code: "not_eligible",
    player: playerAt(state, position),
    eligible: eligible.map((index) => playerAt(state, index)),
  };
}

/** The named player if they are pending, else the first pending one. */
export function pendingPlayer(
  state: HandState,
  pending: readonly boolean[],
  player: Position | undefined
): Result<Position, Refusal> {
  const first = pending.indexOf(true);
  if (first === -1) return err({ code: "not_now" });
  if (player === undefined) return ok(first);
  if (pending[player]) return ok(player);
  return err(
    notEligible(
      state,
      player,
      positionsOf(state).filter((position) => pending[position])
    )
  );
}
