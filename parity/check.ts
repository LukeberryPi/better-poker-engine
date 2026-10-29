import { readFile } from "node:fs/promises";

import { deviations } from "./deviations.ts";
import { outcomesFromJunit, parityReport } from "./report.ts";
import { required } from "./required.ts";

const junitPath = process.argv[2];
if (junitPath === undefined) {
  throw new Error("usage: bun parity/check.ts <junit.xml>");
}

const report = parityReport(
  outcomesFromJunit(await readFile(junitPath, "utf8")),
  new Set(required),
  deviations
);

let passed = 0;
let notRun = 0;
let total = 0;
for (const file of report.files) {
  passed += file.passed;
  notRun += file.notRun;
  total += file.total;
  const marker = file.required ? "required" : "in progress";
  const skipped = file.notRun > 0 ? `, ${file.notRun} not run` : "";
  console.log(
    `${file.file}: ${file.passed}/${file.total}${skipped} (${marker})`
  );
}
console.log(`pokerkit parity: ${passed}/${total} passing, ${notRun} not run`);

for (const { id, deviation } of report.deviations) {
  const examples = deviation.examples.join(", ");
  console.log(`${deviation.kind} ${id} #${examples}: ${deviation.reason}`);
}

if (report.errors.length > 0) {
  for (const error of report.errors) console.error(error);
  process.exit(1);
}
