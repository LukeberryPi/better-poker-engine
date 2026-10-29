import { describe, expect, test } from "bun:test";

import { isWhitespace, wordsOf } from "../src/words.ts";

describe("wordsOf", () => {
  test("splits where Python's str.split() does, with each word's offset", () => {
    expect(wordsOf(" p1\u001ccc\u0085#\u3000x ")).toEqual([
      { text: "p1", at: 1 },
      { text: "cc", at: 4 },
      { text: "#", at: 7 },
      { text: "x", at: 9 },
    ]);
  });

  test("keeps U+FEFF and zero-width spaces inside words, as Python does", () => {
    expect(wordsOf("a\ufeffb\u200bc")).toEqual([
      { text: "a\ufeffb\u200bc", at: 0 },
    ]);
  });

  test("finds no words in blank text", () => {
    expect(wordsOf(" \t\n")).toEqual([]);
  });
});

describe("isWhitespace", () => {
  test("agrees with Python's str.isspace()", () => {
    for (const symbol of [" ", "\t", "\u001c", "\u001f", "\u0085", "\u3000"]) {
      expect({ symbol, space: isWhitespace(symbol) }).toEqual({
        symbol,
        space: true,
      });
    }
    for (const symbol of ["a", "\ufeff", "\u200b", "\u180e"]) {
      expect({ symbol, space: isWhitespace(symbol) }).toEqual({
        symbol,
        space: false,
      });
    }
  });
});
