import cloudflare from "@cloudflare/oxlint-config";
import { defineConfig } from "oxlint";

// @cloudflare/oxlint-config first, then every rule from the former
// .oxlintrc.json, so this repo's choices win where the two disagree.
export default defineConfig({
  ...cloudflare,
  categories: { correctness: "error" },
  plugins: [
    ...new Set([...(cloudflare.plugins ?? []), "eslint", "typescript"]),
  ],
  ignorePatterns: [
    ...(cloudflare.ignorePatterns ?? []),
    "**/dist/**",
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".cursor/**",
    "tools/oxlint/anti-slop/**",
  ],
  jsPlugins: [
    ...(cloudflare.jsPlugins ?? []),
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
  ],
  rules: {
    ...cloudflare.rules,
    // The preset allows mixed promise arrays; the correctness category uses the default.
    "typescript/await-thenable": "error",
    eqeqeq: "error",
    complexity: ["error", { max: 80 }],
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-long-comments": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "typescript/consistent-type-imports": ["error", { prefer: "type-imports" }],
  },
  overrides: [
    ...(cloudflare.overrides ?? []),
    // The preset turns these off for TypeScript; the correctness category had them on.
    {
      files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
      rules: {
        "constructor-super": "error",
        "getter-return": "error",
        "no-class-assign": "error",
        "no-const-assign": "error",
        "no-dupe-class-members": "error",
        "no-dupe-keys": "error",
        "no-func-assign": "error",
        "no-import-assign": "error",
        "no-new-native-nonconstructor": "error",
        "no-obj-calls": "error",
        "no-setter-return": "error",
        "no-this-before-super": "error",
        "no-unreachable": "error",
        "no-unsafe-negation": "error",
        "no-with": "error",
      },
    },
    {
      files: ["packages/better-poker-engine/src/**/*.ts"],
      rules: {
        "no-restricted-globals": [
          "error",
          {
            name: "Date",
            message: "The engine never reads a clock (adrs.md 5).",
          },
          {
            name: "crypto",
            message: "Only src/random.ts may touch crypto (adrs.md 13).",
          },
          {
            name: "console",
            message: "The engine does no I/O (adrs.md 5).",
          },
          { name: "fetch", message: "The engine does no I/O (adrs.md 5)." },
          {
            name: "setTimeout",
            message: "The engine never schedules work (adrs.md 5).",
          },
          {
            name: "setInterval",
            message: "The engine never schedules work (adrs.md 5).",
          },
          {
            name: "process",
            message: "The engine reads no environment (adrs.md 5).",
          },
          {
            name: "Bun",
            message: "The package uses no Bun-only APIs (adrs.md 3).",
          },
        ],
        "no-restricted-properties": [
          "error",
          {
            object: "Math",
            property: "random",
            message: "Take a RandomSource instead (adrs.md 13).",
          },
          {
            object: "performance",
            property: "now",
            message: "The engine never reads a clock (adrs.md 5).",
          },
        ],
      },
    },
    {
      files: ["packages/better-poker-engine/src/random.ts"],
      rules: {
        "no-restricted-globals": "off",
      },
    },
    {
      files: ["parity/check.ts", "parity/extract.ts"],
      rules: { "no-console": "off" },
    },
    {
      files: ["**/*.test.ts", "parity/harness.ts"],
      rules: {
        "anti-slop/no-silent-skip": "error",
        "anti-slop/no-source-text-assertions": "error",
      },
    },
  ],
});
