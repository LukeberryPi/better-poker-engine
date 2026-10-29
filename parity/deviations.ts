import { doctests, type DoctestId } from "./manifest.ts";

/** `differs` examples run and assert our result; the other kinds do not run. */
export type DeviationKind = "differs" | "dropped" | "builtin";

export type Deviation = {
  readonly kind: DeviationKind;
  readonly examples: readonly number[];
  readonly reason: string;
};

export type Deviations = { readonly [Id in DoctestId]?: readonly Deviation[] };

/** Every doctest example that does not keep pokerkit's result, and why. */
export const deviations: Deviations = {
  "pokerkit.games.PotLimitOmahaHoldem.create_state": [
    {
      kind: "differs",
      examples: [1, 4, 5, 6, 7, 8, 11, 12, 13, 14, 19],
      reason:
        "chips are integers in the smallest unit, so the stacks of 1259450.25 and 678473.5 are played in cents and every amount is 100 times pokerkit's",
    },
  ],
  "pokerkit.utilities.rake": [
    {
      kind: "differs",
      examples: [4],
      reason:
        "chips are integers and JavaScript has no separate float 10.0, so 11% of 10 rounds to 1 instead of 1.1",
    },
  ],
  "pokerkit.utilities.divmod": [
    {
      kind: "differs",
      examples: [2],
      reason:
        "chips are integers and JavaScript has no separate float 11.0, so it splits like 11 into (3, 2)",
    },
  ],
  "pokerkit.utilities.filter_none": [
    {
      kind: "builtin",
      examples: [1, 2],
      reason: "Array.prototype.filter covers it",
    },
  ],
  "pokerkit.utilities.sign": [
    { kind: "builtin", examples: [1, 2, 3], reason: "Math.sign covers it" },
  ],
  "pokerkit.utilities.parse_value": [
    {
      kind: "dropped",
      examples: [4],
      reason:
        "Digit separators such as 9,999.99 come only from the online-site " +
        "hand histories whose parsers adrs.md 7 drops. TOML numbers cannot " +
        "hold commas, and PHH writes cbr amounts as plain decimals.",
    },
  ],
  "pokerkit.utilities.parse_month": [
    {
      kind: "dropped",
      examples: [1, 2],
      reason:
        "Month names come only from the online-site hand histories whose " +
        "parsers adrs.md 7 drops; the PHH month field is an integer.",
    },
  ],
};

export function examplesToRun(
  id: DoctestId,
  declared: Deviations = deviations
): number[] {
  const notRun = new Set(
    (declared[id] ?? [])
      .filter((deviation) => deviation.kind !== "differs")
      .flatMap((deviation) => deviation.examples)
  );
  return Array.from(
    { length: doctests[id].examples },
    (_, offset) => offset + 1
  ).filter((index) => !notRun.has(index));
}
