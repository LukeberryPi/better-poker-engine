import { readFile } from "node:fs/promises";

import { outcomesFromJunit, parityReport } from "./report.ts";
import { required } from "./required.ts";

const junitPath = process.argv[2];
if (junitPath === undefined) {
  throw new Error("usage: bun parity/check.ts <junit.xml>");
}

const report = parityReport(
  outcomesFromJunit(await readFile(junitPath, "utf8")),
  new Set(required)
);

let passed = 0;
let total = 0;
for (const file of report.files) {
  passed += file.passed;
  total += file.total;
  const marker = file.required ? "required" : "in progress";
  console.log(`${file.file}: ${file.passed}/${file.total} (${marker})`);
}
console.log(`pokerkit parity: ${passed}/${total}`);

if (report.errors.length > 0) {
  for (const error of report.errors) console.error(error);
  process.exit(1);
}
