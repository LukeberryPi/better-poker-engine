import { expect, test } from "bun:test";
import path from "node:path";

import * as analysis from "better-poker-engine/analysis";

const sources = path.resolve(import.meta.dir, "../src");

async function modulesLoadedBy(specifier: string): Promise<string[]> {
  const build = await Bun.build({
    entrypoints: [Bun.resolveSync(specifier, import.meta.dir)],
    metafile: true,
  });
  return Object.keys(build.metafile?.inputs ?? {}).map((input) =>
    path.resolve(input)
  );
}

function isAnalysisModule(file: string): boolean {
  return (
    file === path.join(sources, "analysis.ts") ||
    file.startsWith(path.join(sources, "analysis") + path.sep)
  );
}

test("the analysis subpath exports the analysis functions", () => {
  expect(Object.keys(analysis).toSorted()).toEqual([
    "equities",
    "handStrength",
    "icm",
    "parseRange",
  ]);
});

test("importing the core loads no analysis code (adrs.md decision 2)", async () => {
  const core = await modulesLoadedBy("better-poker-engine");
  const withAnalysis = await modulesLoadedBy("better-poker-engine/analysis");
  expect(withAnalysis.filter(isAnalysisModule).length).toBeGreaterThan(1);
  expect(core.filter(isAnalysisModule)).toEqual([]);
});
