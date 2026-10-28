import { expect, test } from "bun:test";

import { doctests, pokerkitCommit, unitTests } from "./manifest.ts";

test("the manifest is pokerkit abf7952: 161 unit tests, 1,170 examples", () => {
  const examples = Object.values(doctests).reduce(
    (sum, entry) => sum + entry.examples,
    0
  );
  expect(pokerkitCommit.slice(0, 7)).toBe("abf7952");
  expect(Object.keys(unitTests)).toHaveLength(161);
  expect(examples).toBe(1170);
});
