import type { Chips } from "../chips.ts";
import { err, ok, type Result } from "../result.ts";

/** `no_chips_left`: where pokerkit divides by zero, because no player has chips or its
 * float arithmetic leaves exactly none in play while a place is still to be paid. */
export type IcmError =
  | {
      readonly code: "invalid_stack";
      readonly player: number;
      readonly stack: number;
    }
  | { readonly code: "no_chips_left" };

type Contender = { readonly share: number; value: number; placed: boolean };

type Finish = { readonly contender: Contender; readonly payout: number };

/** pokerkit's `calculate_icm`: each player finishes next with their share of the chips
 * still in play, in pokerkit's float operations and order. As there, every value is 0
 * when more places are paid than players have chips. */
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
  if (payouts.length > stacks.length) return ok(stacks.map(() => 0));
  const contenders = stacks.map((stack): Contender => ({
    share: stack / total,
    value: 0,
    placed: false,
  }));
  const finishes: Finish[] = [];
  const place = (probability: number, remaining: number): boolean => {
    const payout = payouts[finishes.length];
    if (payout === undefined) {
      for (const finish of finishes) {
        finish.contender.value += finish.payout * probability;
      }
      return true;
    }
    for (const contender of contenders) {
      if (contender.placed) continue;
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
  return ok(contenders.map((contender) => contender.value));
}
