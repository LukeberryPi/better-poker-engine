import { describe, expect, test } from "bun:test";

import { parseRange } from "../../src/analysis.ts";
import { known, range, sortedCombos } from "../support.ts";

describe("parseRange", () => {
  test("reports the first invalid notation with its offset", () => {
    expect(parseRange("AK QQ+ XY 2c")).toEqual({
      ok: false,
      error: { code: "invalid_range", at: 7, text: "XY" },
    });
    expect(parseRange("AKs,;\t22 ;  Q")).toEqual({
      ok: false,
      error: { code: "invalid_range", at: 12, text: "Q" },
    });
  });

  test("rejects intervals whose bounds are not shifted by whole ranks", () => {
    for (const text of ["JTs-KJs", "JTs-KQo", "JT-KQs", "TT-JT", "XX-AA"]) {
      expect(parseRange(text)).toEqual({
        ok: false,
        error: { code: "invalid_range", at: 0, text },
      });
    }
  });

  test("rejects cards that are not fully known", () => {
    for (const text of ["????", "A?K?", "?K", "AsKs?"]) {
      expect(parseRange(text).ok).toBe(false);
    }
  });

  test("reads every separator and keeps each combination once", () => {
    expect(sortedCombos(range("AKs,QQ;\tJTs\n22"))).toEqual(
      sortedCombos([...range("AKs"), ...range("QQ JTs 22")])
    );
    expect(range("AK AKs AsKs KA")).toHaveLength(16);
    expect(range("")).toEqual([]);
    expect(range(" ,; ")).toEqual([]);
  });

  test("splits where Python's str.split() does, not at JavaScript's \\s", () => {
    expect(sortedCombos(range("AK\u001cQQ\u0085JJ\u3000T9s"))).toEqual(
      sortedCombos(range("AK QQ JJ T9s"))
    );
    for (const text of ["JJ\ufeffQQ", "AsKh\ufeffQd"]) {
      expect(parseRange(text)).toEqual({
        ok: false,
        error: { code: "invalid_range", at: 0, text },
      });
    }
  });

  test("accepts either rank first", () => {
    expect(sortedCombos(range("KA"))).toEqual(sortedCombos(range("AK")));
    expect(sortedCombos(range("TJ+"))).toEqual(sortedCombos(range("JT+")));
    expect(sortedCombos(range("KQs-JTs"))).toEqual(
      sortedCombos(range("JTs-KQs"))
    );
  });

  test("reads plus and dash notation across the whole rank order", () => {
    expect(range("A2+")).toHaveLength(12 * 16);
    expect(range("22-AA")).toHaveLength(13 * 6);
    expect(range("AA+")).toHaveLength(6);
    expect(sortedCombos(range("QQo+"))).toEqual(sortedCombos(range("QQ+")));
  });

  test("yields no suited pairs, whatever the repeated symbol, as pokerkit", () => {
    expect(range("JJs")).toEqual([]);
    expect(range("QQs+")).toEqual([]);
    expect(range("XXs")).toEqual([]);
  });

  test("reads other notation as explicit cards", () => {
    expect(range("AsAs")).toEqual([known("As")]);
    expect(range("AsKhQd")).toEqual([known("AsKhQd")]);
    expect(range("10s9s")).toEqual([known("Ts9s")]);
  });
});
