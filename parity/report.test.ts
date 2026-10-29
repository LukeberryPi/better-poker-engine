import { expect, test } from "bun:test";

import type { Deviations } from "./deviations.ts";
import { doctests, unitTests } from "./manifest.ts";
import {
  outcomesFromJunit,
  parityReport,
  type FileProgress,
  type Outcome,
  type ParityReport,
} from "./report.ts";

const rulesFile = "pokerkit/tests/test_rules.py";
const rulesIds = Object.entries(unitTests)
  .filter(([, file]) => file === rulesFile)
  .map(([id]) => id);
const utilitiesFile = "pokerkit/utilities.py";
const utilitiesIds = Object.entries(doctests)
  .filter(([, entry]) => entry.file === utilitiesFile)
  .map(([id]) => id);

function passing(ids: readonly string[]): Map<string, Outcome[]> {
  return new Map(ids.map((id) => [id, ["passed"]]));
}

function progressOf(
  report: ParityReport,
  file: string
): FileProgress | undefined {
  return report.files.find((entry) => entry.file === file);
}

test("junit test cases are read as passed, failed or skipped", () => {
  const xml = `<testsuite>
    <testcase name="a" classname="" time="0" file="x.test.ts" line="1" assertions="1" />
    <testcase name="b" classname="" time="0" file="x.test.ts" line="2" assertions="1">
      <failure type="AssertionError" />
    </testcase>
    <testcase name="c" classname="" time="0" file="x.test.ts" line="3" assertions="0">
      <skipped />
    </testcase>
  </testsuite>`;
  expect(outcomesFromJunit(xml)).toEqual(
    new Map([
      ["a", ["passed"]],
      ["b", ["failed"]],
      ["c", ["skipped"]],
    ])
  );
});

test("a required file with a missing id is an error naming the id", () => {
  expect(rulesIds).toHaveLength(2);
  const [ported, missing] = rulesIds;
  const report = parityReport(
    passing(ported === undefined ? [] : [ported]),
    new Set([rulesFile]),
    {}
  );
  expect(report.errors).toEqual([
    `${missing}: missing (${rulesFile} is required)`,
  ]);
});

test("a fully passing required file reports no errors", () => {
  const report = parityReport(passing(rulesIds), new Set([rulesFile]), {});
  expect(report.errors).toEqual([]);
  expect(progressOf(report, rulesFile)).toEqual({
    file: rulesFile,
    required: true,
    total: 2,
    passed: 2,
    notRun: 0,
  });
});

test("a passing docstring counts every one of its examples", () => {
  const report = parityReport(
    passing(["pokerkit.analysis.calculate_equities"]),
    new Set(),
    {}
  );
  expect(progressOf(report, "pokerkit/analysis.py")).toEqual({
    file: "pokerkit/analysis.py",
    required: false,
    total: 17,
    passed: 5,
    notRun: 0,
  });
});

test("files that are not required yet only report progress", () => {
  expect(parityReport(new Map(), new Set(), {}).errors).toEqual([]);
});

test("an id ported twice is an error even when both copies pass", () => {
  const [id] = rulesIds;
  if (id === undefined) throw new Error("test_rules.py has no tests");
  const report = parityReport(
    new Map([[id, ["passed", "passed"]]]),
    new Set(),
    {}
  );
  expect(report.errors).toEqual([`${id}: ported 2 times`]);
});

test("a fully dropped docstring needs no test, even when required", () => {
  const declared: Deviations = {
    "pokerkit.utilities.parse_month": [
      { kind: "dropped", examples: [1, 2], reason: "site parsers only" },
    ],
    "pokerkit.utilities.sign": [
      { kind: "builtin", examples: [3], reason: "Math.sign" },
    ],
  };
  const ported = utilitiesIds.filter(
    (id) => id !== "pokerkit.utilities.parse_month"
  );
  const report = parityReport(
    passing(ported),
    new Set([utilitiesFile]),
    declared
  );
  expect(report.errors).toEqual([]);
  expect(progressOf(report, utilitiesFile)).toEqual({
    file: utilitiesFile,
    required: true,
    total: 103,
    passed: 100,
    notRun: 3,
  });
  expect(report.deviations.map((entry) => entry.id)).toEqual([
    "pokerkit.utilities.parse_month",
    "pokerkit.utilities.sign",
  ]);
});

test("a differing example still has to run and pass", () => {
  const declared: Deviations = {
    "pokerkit.utilities.divmod": [
      { kind: "differs", examples: [2], reason: "11.0 === 11 in JS" },
    ],
  };
  const report = parityReport(new Map(), new Set([utilitiesFile]), declared);
  expect(report.errors).toContain(
    `pokerkit.utilities.divmod: missing (${utilitiesFile} is required)`
  );
});

test("deviations must name real, distinct examples", () => {
  const declared: Deviations = {
    "pokerkit.utilities.sign": [
      { kind: "builtin", examples: [3, 4], reason: "Math.sign" },
      { kind: "differs", examples: [3], reason: "again" },
    ],
  };
  expect(parityReport(new Map(), new Set(), declared).errors).toEqual([
    "pokerkit.utilities.sign: deviation example 4 is not in 1..3",
    "pokerkit.utilities.sign: example 3 is declared as a deviation twice",
  ]);
});
