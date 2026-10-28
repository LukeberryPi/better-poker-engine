import { expect, test } from "bun:test";

import { doctests, type DoctestId, type UnitTestId } from "./manifest.ts";

export type Example = (index: number, run: () => void) => void;
export type ParityOptions = { readonly timeout?: number };

export function unitTest(
  id: UnitTestId,
  run: () => void | Promise<void>,
  options: ParityOptions = {}
): void {
  test(id, run, options.timeout);
}

/** Fails unless examples 1..n of the docstring each ran once, in order. */
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
      const expected = Array.from(
        { length: doctests[id].examples },
        (_, offset) => offset + 1
      );
      expect(ran).toEqual(expected);
    },
    options.timeout
  );
}
