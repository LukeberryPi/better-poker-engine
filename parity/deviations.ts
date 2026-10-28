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
