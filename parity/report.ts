import {
  examplesToRun,
  type Deviation,
  type Deviations,
} from "./deviations.ts";
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
  readonly notRun: number;
};

export type DeclaredDeviation = {
  readonly id: DoctestId;
  readonly deviation: Deviation;
};

export type ParityReport = {
  readonly files: readonly FileProgress[];
  readonly deviations: readonly DeclaredDeviation[];
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
  readonly notRun: number;
};

function entries(declared: Deviations): readonly ManifestEntry[] {
  const unit = Object.entries(unitTests).map(([id, file]) => ({
    // SAFETY: Object.entries over the const manifest yields its own keys.
    id: id as UnitTestId,
    file,
    cases: 1,
    notRun: 0,
  }));
  const doc = Object.entries(doctests).map(([key, entry]) => {
    // SAFETY: Object.entries over the const manifest yields its own keys.
    const id = key as DoctestId;
    const notRun = entry.examples - examplesToRun(id, declared).length;
    return { id, file: entry.file, cases: entry.examples, notRun };
  });
  return [...unit, ...doc];
}

function deviationErrors(declared: Deviations): string[] {
  return Object.entries(doctests).flatMap(([key, entry]) => {
    // SAFETY: Object.entries over the const manifest yields its own keys.
    const id = key as DoctestId;
    const indexes = (declared[id] ?? []).flatMap((item) => item.examples);
    const outOfRange = indexes.filter(
      (index) => !Number.isInteger(index) || index < 1 || index > entry.examples
    );
    const repeated = indexes.filter(
      (index, position) => indexes.indexOf(index) !== position
    );
    return [
      ...outOfRange.map(
        (index) =>
          `${id}: deviation example ${index} is not in 1..${entry.examples}`
      ),
      ...repeated.map(
        (index) => `${id}: example ${index} is declared as a deviation twice`
      ),
    ];
  });
}

export function parityReport(
  outcomes: ReadonlyMap<string, readonly Outcome[]>,
  required: ReadonlySet<SourceFile>,
  declared: Deviations
): ParityReport {
  const progress = new Map<
    SourceFile,
    { total: number; passed: number; notRun: number }
  >();
  const errors = deviationErrors(declared);
  for (const { id, file, cases, notRun } of entries(declared)) {
    const results = outcomes.get(id) ?? [];
    const passed = results.length === 1 && results[0] === "passed";
    const counts = progress.get(file) ?? { total: 0, passed: 0, notRun: 0 };
    progress.set(file, {
      total: counts.total + cases,
      passed: counts.passed + (passed ? cases - notRun : 0),
      notRun: counts.notRun + notRun,
    });
    if (results.length > 1)
      errors.push(`${id}: ported ${results.length} times`);
    else if (!passed && notRun < cases && required.has(file)) {
      errors.push(`${id}: ${results[0] ?? "missing"} (${file} is required)`);
    }
  }
  const files = [...progress].map(([file, counts]) => ({
    file,
    required: required.has(file),
    ...counts,
  }));
  const listed = Object.keys(doctests).flatMap((key) => {
    // SAFETY: Object.keys over the const manifest yields its own keys.
    const id = key as DoctestId;
    return (declared[id] ?? []).map((deviation) => ({ id, deviation }));
  });
  return { files, deviations: listed, errors };
}
