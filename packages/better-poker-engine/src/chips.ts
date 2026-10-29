/** A non-negative safe integer in the table's smallest unit (cents, chips). */
export type Chips = number;

/** A stack of unknown size that covers every bet; only hand histories produce it. */
export type Unbounded = "unbounded";

export type Stack = Chips | Unbounded;

export function isChips(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function addToStack(stack: Stack, amount: Chips): Stack {
  return stack === "unbounded" ? stack : stack + amount;
}

export function takeFromStack(stack: Stack, amount: Chips): Stack {
  return stack === "unbounded" ? stack : stack - amount;
}

/** The smaller of the two: an unbounded stack never limits an amount. */
export function capAt(amount: Chips, stack: Stack): Chips {
  return stack === "unbounded" ? amount : Math.min(amount, stack);
}

export function minStack(a: Stack, b: Stack): Stack {
  if (a === "unbounded") return b;
  if (b === "unbounded") return a;
  return Math.min(a, b);
}

export function exceeds(stack: Stack, amount: Chips): boolean {
  return stack === "unbounded" || stack > amount;
}

export function compareStacks(a: Stack, b: Stack): number {
  if (a === b) return 0;
  if (a === "unbounded") return 1;
  if (b === "unbounded") return -1;
  return a - b;
}
