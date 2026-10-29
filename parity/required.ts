import type { SourceFile } from "./manifest.ts";

/** pokerkit files whose every test and example must pass; grows as ports land. */
export const required: readonly SourceFile[] = [
  "pokerkit/hands.py",
  "pokerkit/lookups.py",
  "pokerkit/state.py",
  "pokerkit/tests/test_lookups.py",
  "pokerkit/tests/test_notation.py",
  "pokerkit/tests/test_rules.py",
  "pokerkit/tests/test_state.py",
  "pokerkit/tests/test_utilities.py",
];
