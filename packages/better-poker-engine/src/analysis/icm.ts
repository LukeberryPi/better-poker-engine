import type { Chips } from "../chips.ts";
import { err, ok, type Result } from "../result.ts";

/** `no_chips_left`: no player has chips, or float arithmetic leaves exactly none in
 * play while a place is still to be paid. pokerkit divides by zero in both. */
export type IcmError =
  | {
      readonly code: "invalid_stack";
      readonly player: number;
      readonly stack: number;
    }
  | { readonly code: "no_chips_left" };

type Contender = { readonly share: number; value: number; placed: boolean };

type Finish = { readonly contender: Contender; readonly payout: number };

/** pokerkit's `calculate_icm` for players with chips: each finishes next with their
 * share of the chips still in play, in pokerkit's float operations and order. Players
 * without chips finish below them and share the places left evenly; pokerkit pays 0. */
export function icm(
  payouts: readonly number[],
  stacks: readonly Chips[]
): Result<readonly number[], IcmError> {
  for (const [player, stack] of stacks.entries()) {
    if (!Number.isSafeInteger(stack) || stack < 0) {
      return err({ code: "invalid_stack", player, stack });
    }
  }
  const total = stacks.reduce((sum, stack) => sum + stack, 0);
  if (stacks.length > 0 && total === 0) return err({ code: "no_chips_left" });
  const contenders = stacks.map((stack): Contender => ({
    share: stack / total,
    value: 0,
    placed: false,
  }));
  const holders = stacks.filter((stack) => stack > 0).length;
  const contested = payouts.slice(0, holders);
  const finishes: Finish[] = [];
  const place = (probability: number, remaining: number): boolean => {
    const payout = contested[finishes.length];
    if (payout === undefined) {
      for (const finish of finishes) {
        finish.contender.value += finish.payout * probability;
      }
      return true;
    }
    for (const contender of contenders) {
      if (contender.placed || contender.share === 0) continue;
      if (remaining === 0) return false;
      contender.placed = true;
      finishes.push({ contender, payout });
      const paid = place(
        probability * (contender.share / remaining),
        remaining - contender.share
      );
      finishes.pop();
      contender.placed = false;
      if (!paid) return false;
    }
    return true;
  };
  if (!place(1, 1)) return err({ code: "no_chips_left" });
  const busted = stacks.length - holders;
  const left = payouts.slice(holders, stacks.length);
  const shared =
    busted === 0 ? 0 : left.reduce((sum, payout) => sum + payout, 0) / busted;
  return ok(
    contenders.map((contender) =>
      contender.share === 0 ? shared : contender.value
    )
  );
}
