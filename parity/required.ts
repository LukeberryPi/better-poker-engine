import type { SourceFile } from "./manifest.ts";

/** pokerkit files whose every test and example must pass; grows as ports land. */
export const required: readonly SourceFile[] = [
  "pokerkit/analysis.py",
  "pokerkit/hands.py",
  "pokerkit/lookups.py",
  "pokerkit/tests/test_analysis.py",
  "pokerkit/tests/test_lookups.py",
  "pokerkit/tests/test_utilities.py",
];
