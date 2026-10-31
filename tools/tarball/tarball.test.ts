import { afterAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import manifest from "../../packages/better-poker-engine/package.json" with { type: "json" };

const packageDir = path.resolve(
  import.meta.dir,
  "../../packages/better-poker-engine"
);
const tsc = path.resolve(import.meta.dir, "../../node_modules/.bin/tsc");

const entryPoints = Object.entries(manifest.exports).map(
  ([subpath, targets]) => ({
    specifier: path.posix.join(manifest.name, subpath),
    source: path.join(packageDir, targets["@better-poker-engine/source"]),
  })
);

function run(command: string[], cwd: string): string {
  const { exitCode, stdout, stderr } = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (exitCode !== 0) {
    throw new Error(
      `${command.join(" ")} exited ${exitCode}\n${stdout}${stderr}`
    );
  }
  return stdout.toString();
}

async function runtimeExports(source: string): Promise<string[]> {
  return Object.keys(await import(source)).toSorted();
}

const consumer = await mkdtemp(path.join(tmpdir(), "better-poker-engine-"));
afterAll(() => rm(consumer, { recursive: true, force: true }));

run(["npm", "pack", "--pack-destination", consumer], packageDir);
const tarball = path.join(consumer, `${manifest.name}-${manifest.version}.tgz`);
const installed = path.join(consumer, "node_modules", manifest.name);
await mkdir(installed, { recursive: true });
run(
  ["tar", "-xzf", tarball, "-C", installed, "--strip-components=1"],
  consumer
);
for (const dependency of Object.keys(manifest.dependencies)) {
  await symlink(
    path.join(packageDir, "node_modules", dependency),
    path.join(consumer, "node_modules", dependency)
  );
}
await writeFile(path.join(consumer, "package.json"), '{ "type": "module" }');

test("the tarball holds the build, the sources and the license notices", () => {
  const sources = Array.from(
    new Bun.Glob("src/**/*.ts").scanSync({ cwd: packageDir })
  );
  const builds = sources.flatMap((source) => {
    const stem = path.join("dist", path.relative("src", source.slice(0, -3)));
    return [`${stem}.js`, `${stem}.d.ts`];
  });
  const packed = run(["tar", "-tzf", tarball], consumer)
    .trim()
    .split("\n")
    .map((entry) => entry.replace(/^package\//u, ""));

  expect(packed.toSorted()).toEqual(
    [
      ...sources,
      ...builds,
      "LICENSE",
      "NOTICE",
      "README.md",
      "package.json",
    ].toSorted()
  );
});

test("Node loads every entry point with its source module's exports", async () => {
  for (const { specifier, source } of entryPoints) {
    const loaded = run(
      [
        "node",
        "--input-type=module",
        "--eval",
        `const entry = await import(${JSON.stringify(specifier)});
         console.log(Object.keys(entry).sort().join("\\n"));`,
      ],
      consumer
    );
    expect(loaded.trim().split("\n")).toEqual(await runtimeExports(source));
  }
});

test("TypeScript types every runtime export of every entry point", async () => {
  const lines: string[] = [];
  for (const [index, { specifier, source }] of entryPoints.entries()) {
    lines.push(`import * as entry${index} from ${JSON.stringify(specifier)};`);
    for (const name of await runtimeExports(source)) {
      lines.push(`entry${index}.${name};`);
    }
  }
  await writeFile(path.join(consumer, "index.ts"), lines.join("\n"));
  await writeFile(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, skipLibCheck: false },
      files: ["index.ts"],
    })
  );

  expect(run([tsc, "-p", ".", "--module", "nodenext"], consumer)).toBe("");
  expect(
    run(
      [tsc, "-p", ".", "--module", "preserve", "--moduleResolution", "bundler"],
      consumer
    )
  ).toBe("");
});
