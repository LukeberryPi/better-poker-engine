import { expect, test } from "bun:test";

import { examplesToRun } from "./deviations.ts";
import type { DoctestId, UnitTestId } from "./manifest.ts";

export type Example = (index: number, run: () => void) => void;
export type ParityOptions = { readonly timeout?: number };

export function unitTest(
  id: UnitTestId,
  run: () => void | Promise<void>,
  options: ParityOptions = {}
): void {
  test(id, run, options.timeout);
}

/** Fails unless each example ran once, in order, except dropped or builtin ones. */
export function doctest(
  id: DoctestId,
  run: (example: Example) => void,
  options: ParityOptions = {}
): void {
  test(
    id,
    () => {
      const ran: number[] = [];
      run((index, body) => {
        ran.push(index);
        body();
      });
      expect(ran).toEqual(examplesToRun(id));
    },
    options.timeout
  );
}
