/** A non-negative safe integer in the table's smallest unit (cents, chips). */
export type Chips = number;

/** A stack of unknown size that covers every bet; only hand histories produce it. */
export type Unbounded = "unbounded";

export type Stack = Chips | Unbounded;
