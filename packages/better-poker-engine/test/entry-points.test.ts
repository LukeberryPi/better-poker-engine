import { expect, test } from "bun:test";

import manifest from "../package.json" with { type: "json" };

async function bundledModules(entry: string): Promise<readonly string[]> {
  const result = await Bun.build({
    entrypoints: [new URL(entry, new URL("../", import.meta.url)).pathname],
    metafile: true,
  });
  if (!result.success || result.metafile === undefined) {
    throw new Error(`Bun.build failed for ${entry}`);
  }
  return Object.keys(result.metafile.inputs);
}

test("the core entry point loads no TOML or PHH code (adrs.md 2)", async () => {
  const modules = await bundledModules(
    manifest.exports["."]["@better-poker-engine/source"]
  );
  expect(modules.some((path) => path.endsWith("src/cards.ts"))).toBe(true);
  expect(modules.filter((path) => /toml|phh/iu.test(path))).toEqual([]);
});

test("the /phh entry point loads smol-toml and zod", async () => {
  const modules = await bundledModules(
    manifest.exports["./phh"]["@better-poker-engine/source"]
  );
  expect(modules.some((path) => path.endsWith("src/phh.ts"))).toBe(true);
  expect(modules.some((path) => path.includes("/smol-toml/"))).toBe(true);
  expect(modules.some((path) => path.includes("/zod/"))).toBe(true);
});
