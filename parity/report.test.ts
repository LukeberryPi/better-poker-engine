import { expect, test } from "bun:test";

import { unitTests } from "./manifest.ts";
import { outcomesFromJunit, parityReport, type Outcome } from "./report.ts";

const rulesFile = "pokerkit/tests/test_rules.py";
const rulesIds = Object.entries(unitTests)
  .filter(([, file]) => file === rulesFile)
  .map(([id]) => id);

function passing(ids: readonly string[]): Map<string, Outcome[]> {
  return new Map(ids.map((id) => [id, ["passed"]]));
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
    new Set([rulesFile])
  );
  expect(report.errors).toEqual([
    `${missing}: missing (${rulesFile} is required)`,
  ]);
});

test("a fully passing required file reports no errors", () => {
  const report = parityReport(passing(rulesIds), new Set([rulesFile]));
  expect(report.errors).toEqual([]);
  expect(report.files.find((file) => file.file === rulesFile)).toEqual({
    file: rulesFile,
    required: true,
    total: 2,
    passed: 2,
  });
});

test("a passing docstring counts every one of its examples", () => {
  const report = parityReport(
    passing(["pokerkit.analysis.calculate_equities"]),
    new Set()
  );
  expect(
    report.files.find((file) => file.file === "pokerkit/analysis.py")
  ).toEqual({
    file: "pokerkit/analysis.py",
    required: false,
    total: 17,
    passed: 5,
  });
});

test("files that are not required yet only report progress", () => {
  expect(parityReport(new Map(), new Set()).errors).toEqual([]);
});

test("an id ported twice is an error even when both copies pass", () => {
  const [id] = rulesIds;
  if (id === undefined) throw new Error("test_rules.py has no tests");
  const report = parityReport(new Map([[id, ["passed", "passed"]]]), new Set());
  expect(report.errors).toEqual([`${id}: ported 2 times`]);
});
