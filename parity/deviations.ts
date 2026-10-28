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
