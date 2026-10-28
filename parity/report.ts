import {
  doctests,
  unitTests,
  type DoctestId,
  type SourceFile,
  type UnitTestId,
} from "./manifest.ts";

export type Outcome = "passed" | "failed" | "skipped";

/** Counts are cases: one per unit test, one per doctest example. */
export type FileProgress = {
  readonly file: SourceFile;
  readonly required: boolean;
  readonly total: number;
  readonly passed: number;
};

export type ParityReport = {
  readonly files: readonly FileProgress[];
  readonly errors: readonly string[];
};

const testCase =
  /<testcase\b[^>]*?\bname="([^"]*)"[^>]*?(?:\/>|>([\s\S]*?)<\/testcase>)/g;

export function outcomesFromJunit(xml: string): Map<string, Outcome[]> {
  const outcomes = new Map<string, Outcome[]>();
  for (const match of xml.matchAll(testCase)) {
    const name = match[1];
    if (name === undefined) continue;
    const body = match[2] ?? "";
    const outcome: Outcome = /<(failure|error)\b/.test(body)
      ? "failed"
      : /<skipped\b/.test(body)
        ? "skipped"
        : "passed";
    outcomes.set(name, [...(outcomes.get(name) ?? []), outcome]);
  }
  return outcomes;
}

type ManifestEntry = {
  readonly id: UnitTestId | DoctestId;
  readonly file: SourceFile;
  readonly cases: number;
};

function entries(): readonly ManifestEntry[] {
  const unit = Object.entries(unitTests).map(([id, file]) => ({
    // SAFETY: Object.entries over the const manifest yields its own keys.
    id: id as UnitTestId,
    file,
    cases: 1,
  }));
  const doc = Object.entries(doctests).map(([id, entry]) => ({
    // SAFETY: Object.entries over the const manifest yields its own keys.
    id: id as DoctestId,
    file: entry.file,
    cases: entry.examples,
  }));
  return [...unit, ...doc];
}

export function parityReport(
  outcomes: ReadonlyMap<string, readonly Outcome[]>,
  required: ReadonlySet<SourceFile>
): ParityReport {
  const progress = new Map<SourceFile, { total: number; passed: number }>();
  const errors: string[] = [];
  for (const { id, file, cases } of entries()) {
    const results = outcomes.get(id) ?? [];
    const passed = results.length === 1 && results[0] === "passed";
    const counts = progress.get(file) ?? { total: 0, passed: 0 };
    progress.set(file, {
      total: counts.total + cases,
      passed: counts.passed + (passed ? cases : 0),
    });
    if (results.length > 1)
      errors.push(`${id}: ported ${results.length} times`);
    else if (!passed && required.has(file)) {
      errors.push(`${id}: ${results[0] ?? "missing"} (${file} is required)`);
    }
  }
  const files = [...progress].map(([file, counts]) => ({
    file,
    required: required.has(file),
    ...counts,
  }));
  return { files, errors };
}
