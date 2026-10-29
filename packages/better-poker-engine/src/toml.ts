import {
  parse,
  TomlDate,
  TomlError,
  type TomlTable,
  type TomlValue,
} from "smol-toml";
import * as z from "zod/mini";

import { err, ok, type Result } from "./result.ts";

/** A user-defined value and its TOML type. A float holds JavaScript's shortest
 * digits (`"3"` is 3.0); a datetime holds TOML text such as `1979-05-27`. */
export type PhhValue =
  | { readonly type: "string"; readonly value: string }
  | { readonly type: "integer"; readonly value: `${bigint}` }
  | {
      readonly type: "float";
      readonly value: `${number}` | "inf" | "-inf" | "nan";
    }
  | { readonly type: "boolean"; readonly value: boolean }
  | { readonly type: "datetime"; readonly value: string }
  | { readonly type: "array"; readonly value: readonly PhhValue[] }
  | {
      readonly type: "table";
      readonly value: Readonly<Record<string, PhhValue>>;
    };

export type TomlSyntaxError = {
  readonly code: "toml";
  readonly line: number;
  readonly column: number;
  readonly message: string;
};

/** Integers come back as bigints so that `3` and `3.0` stay distinct. */
export function readToml(text: string): Result<TomlTable, TomlSyntaxError> {
  try {
    return ok(parse(text, { integersAsBigInt: true }));
  } catch (error) {
    if (!(error instanceof TomlError)) throw error;
    const [summary = ""] = error.message.split("\n", 1);
    return err({
      code: "toml",
      line: error.line,
      column: error.column,
      message: summary.replace(/^Invalid TOML document: /u, ""),
    });
  }
}

/** smol-toml builds tables as plain objects; its other objects are arrays and dates. */
export function isTable(value: TomlValue): value is TomlTable {
  return (
    Object(value) === value &&
    !Array.isArray(value) &&
    !(value instanceof TomlDate)
  );
}

function floatText(value: number): `${number}` | "inf" | "-inf" | "nan" {
  if (Number.isNaN(value)) return "nan";
  if (value === Infinity) return "inf";
  if (value === -Infinity) return "-inf";
  return Object.is(value, -0) ? "-0" : `${value}`;
}

const scalarValue = z.union([
  z.pipe(
    z.string(),
    z.transform((value): PhhValue => ({ type: "string", value }))
  ),
  z.pipe(
    z.boolean(),
    z.transform((value): PhhValue => ({ type: "boolean", value }))
  ),
  z.pipe(
    z.bigint(),
    z.transform((value): PhhValue => ({ type: "integer", value: `${value}` }))
  ),
  z.pipe(
    z.union([z.number(), z.nan(), z.literal(Infinity), z.literal(-Infinity)]),
    z.transform((value): PhhValue => ({
      type: "float",
      value: floatText(value),
    }))
  ),
  z.pipe(
    z.instanceof(TomlDate),
    z.transform((value): PhhValue => ({
      type: "datetime",
      value: value.toISOString(),
    }))
  ),
]);

export function userValueOf(value: TomlValue): PhhValue {
  if (Array.isArray(value)) {
    return { type: "array", value: value.map(userValueOf) };
  }
  if (!isTable(value)) return scalarValue.parse(value);
  const entries = Object.entries(value).map(
    ([key, item]) => [key, userValueOf(item)] as const
  );
  return { type: "table", value: Object.fromEntries(entries) };
}

function isControl(character: string): boolean {
  const code = character.charCodeAt(0);
  return code < 0x20 || code === 0x7f;
}

/** Literal strings may hold a tab but no other control character. */
function fitsLiteral(text: string): boolean {
  return Array.from(text).every(
    (character) => character === "\t" || !isControl(character)
  );
}

const escapes = new Map([
  ["\b", "\\b"],
  ["\t", "\\t"],
  ["\n", "\\n"],
  ["\f", "\\f"],
  ["\r", "\\r"],
  ['"', '\\"'],
  ["\\", "\\\\"],
]);

function basicString(text: string): string {
  const escaped = Array.from(
    text,
    (character) =>
      escapes.get(character) ??
      (isControl(character)
        ? `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
        : character)
  );
  return `"${escaped.join("")}"`;
}

/** pokerkit's quoting: `'...'`, or `'''...'''` around a `'`. Text those cannot
 * hold, such as a newline, gets an escaped `"..."` string instead. */
export function tomlString(text: string): string {
  if (!fitsLiteral(text) || text.includes("'''")) return basicString(text);
  return text.includes("'") ? `'''${text}'''` : `'${text}'`;
}

export function tomlKey(key: string): string {
  if (/^[\w-]+$/u.test(key)) return key;
  return fitsLiteral(key) && !key.includes("'") ? `'${key}'` : basicString(key);
}

export function tomlArray(items: readonly string[]): string {
  return `[${items.join(", ")}]`;
}

export function tomlValue(value: PhhValue): string {
  switch (value.type) {
    case "string":
      return tomlString(value.value);
    case "float":
      return /^[+-]?\d+$/u.test(value.value) ? `${value.value}.0` : value.value;
    case "boolean":
      return String(value.value);
    case "integer":
    case "datetime":
      return value.value;
    case "array":
      return tomlArray(value.value.map(tomlValue));
    case "table": {
      const entries = Object.entries(value.value).map(
        ([key, item]) => `${tomlKey(key)} = ${tomlValue(item)}`
      );
      return `{${entries.join(", ")}}`;
    }
  }
}
