/// <reference types="bun" />

import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dir, "../../..");
let fixtureDirectory = "";

beforeAll(async () => {
  fixtureDirectory = await mkdtemp(path.join(tmpdir(), "anti-slop-oxlint-"));
});

afterAll(async () => {
  await rm(fixtureDirectory, { recursive: true, force: true });
});

async function lintFixture(name: string, source: string) {
  const fixturePath = path.join(fixtureDirectory, name);
  await writeFile(fixturePath, source);
  const child = Bun.spawn(
    [
      path.join(repositoryRoot, "node_modules/.bin/oxlint"),
      "-c",
      path.join(repositoryRoot, ".oxlintrc.json"),
      "--deny-warnings",
      fixturePath,
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        NODE_OPTIONS: "--experimental-strip-types",
      },
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, output: `${stdout}\n${stderr}` };
}

test("no-long-comments enforces the three-line boundary", async () => {
  const rejected = await lintFixture(
    "long-comment.ts",
    "// one\n// two\n// three\n// four\nexport {};\n"
  );
  const accepted = await lintFixture(
    "short-comment.ts",
    "// one\n// two\n// three\nexport {};\n"
  );
  const trailing = await lintFixture(
    "trailing-comments.ts",
    "void 1; // one\nvoid 2; // two\nvoid 3; // three\nvoid 4; // four\n"
  );

  expect(rejected.exitCode).not.toBe(0);
  expect(rejected.output).toContain("no-long-comments");
  expect(accepted.exitCode).toBe(0);
  expect(trailing.exitCode).toBe(0);
});
