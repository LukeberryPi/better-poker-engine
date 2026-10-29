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
export const deviations: Deviations = {};

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
