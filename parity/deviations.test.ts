import { expect, test } from "bun:test";

import { examplesToRun, type Deviations } from "./deviations.ts";

test("dropped and builtin examples are not run; differing ones are", () => {
  const declared: Deviations = {
    "pokerkit.utilities.Card.parse": [
      { kind: "dropped", examples: [2], reason: "dropped" },
      { kind: "builtin", examples: [5], reason: "builtin" },
      { kind: "differs", examples: [7], reason: "differs" },
    ],
  };
  expect(examplesToRun("pokerkit.utilities.Card.parse", declared)).toEqual([
    1, 3, 4, 6, 7,
  ]);
  expect(examplesToRun("pokerkit.utilities.Card.parse", {})).toEqual([
    1, 2, 3, 4, 5, 6, 7,
  ]);
});
