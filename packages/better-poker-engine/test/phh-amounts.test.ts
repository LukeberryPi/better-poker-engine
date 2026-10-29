import { describe, expect, test } from "bun:test";

import {
  amountScales,
  canonicalDecimal,
  fromChips,
  toBlindChips,
  toChips,
} from "../src/phh-amounts.ts";
import { err, ok } from "../src/result.ts";

describe("canonicalDecimal", () => {
  test("drops trailing zeros, leading zeros and a needless point", () => {
    expect(canonicalDecimal("24.50")).toBe("24.5");
    expect(canonicalDecimal("0.10")).toBe("0.1");
    expect(canonicalDecimal("007")).toBe("7");
    expect(canonicalDecimal("5.")).toBe("5");
    expect(canonicalDecimal("3.000")).toBe("3");
  });

  test("writes exponents out as plain digits", () => {
    expect(canonicalDecimal("1e+21")).toBe("1000000000000000000000");
    expect(canonicalDecimal("1.5e-7")).toBe("0.00000015");
    expect(canonicalDecimal("12E2")).toBe("1200");
    expect(String(canonicalDecimal("5e-324"))).toBe(`0.${"0".repeat(323)}5`);
  });

  test("keeps the sign of a negative amount but not of zero", () => {
    expect(canonicalDecimal("-0.25")).toBe("-0.25");
    expect(canonicalDecimal("-0")).toBe("0");
    expect(canonicalDecimal("+5")).toBe("5");
  });

  test("reads every other numeric string that Number accepts", () => {
    expect(canonicalDecimal(".5")).toBe("0.5");
    expect(canonicalDecimal(" 5 ")).toBe("5");
    expect(canonicalDecimal("0x1F")).toBe("31");
    expect(canonicalDecimal("0b101")).toBe("5");
    expect(canonicalDecimal("")).toBe("0");
  });

  test("rejects text that is not a finite number", () => {
    for (const text of ["Infinity", "NaN", "1_000", "1,000", ".", "e5", "-"]) {
      expect(canonicalDecimal(text)).toBeNull();
    }
  });
});

describe("toChips", () => {
  test("scales decimal amounts without floating-point error", () => {
    expect(toChips("0.29", 100)).toEqual(ok(29));
    expect(toChips("0.07", 100)).toEqual(ok(7));
    expect(toChips("1.15", 100)).toEqual(ok(115));
    expect(toChips("1259450.25", 100)).toEqual(ok(125945025));
  });

  test("keeps whole amounts whole at scale 1", () => {
    expect(toChips("7000", 1)).toEqual(ok(7000));
    expect(toChips("0", 1)).toEqual(ok(0));
    expect(toChips("1e3", 1)).toEqual(ok(1000));
  });

  test("reports a fraction left over instead of rounding", () => {
    expect(toChips("0.295", 100)).toEqual(
      err({ code: "not_integral", amount: "0.295", scale: 100 })
    );
    expect(toChips("0.5", 1)).toEqual(
      err({ code: "not_integral", amount: "0.5", scale: 1 })
    );
  });

  test("accepts amounts up to the largest safe integer", () => {
    expect(toChips("9007199254740991", 1)).toEqual(ok(Number.MAX_SAFE_INTEGER));
    expect(toChips("90071992547.40991", 100_000)).toEqual(
      ok(Number.MAX_SAFE_INTEGER)
    );
  });

  test("rejects amounts that are negative or beyond a safe integer", () => {
    for (const [amount, scale] of [
      ["9007199254740992", 1],
      ["10", 1_000_000_000_000_000],
      ["1e16", 1],
      ["-1", 1],
      ["-0.25", 100],
    ] as const) {
      expect(toChips(amount, scale)).toEqual(
        err({ code: "out_of_range", amount, scale })
      );
    }
  });

  test("offers each power of ten that is a safe integer as a scale", () => {
    expect(amountScales).toHaveLength(16);
    expect(amountScales.every(Number.isSafeInteger)).toBe(true);
    expect(Number.isSafeInteger((amountScales.at(-1) ?? 0) * 10)).toBe(false);
    for (const [power, scale] of amountScales.entries()) {
      expect(toChips("1", scale)).toEqual(ok(10 ** power));
    }
  });
});

describe("fromChips", () => {
  test("writes chips back as the decimal toChips read", () => {
    expect(fromChips(29, 100)).toBe("0.29");
    expect(fromChips(125945025, 100)).toBe("1259450.25");
    expect(fromChips(2500, 100)).toBe("25");
    expect(fromChips(7000, 1)).toBe("7000");
    expect(fromChips(0, 100)).toBe("0");
    expect(fromChips(Number.MAX_SAFE_INTEGER, 100_000)).toBe(
      "90071992547.40991"
    );
  });

  test("writes a post bet with its sign", () => {
    expect(fromChips(-25, 100)).toBe("-0.25");
    expect(fromChips(-2500, 100)).toBe("-25");
  });
});

describe("toBlindChips", () => {
  test("converts a post bet's size exactly and keeps its sign", () => {
    expect(toBlindChips("-0.25", 100)).toEqual(ok(-25));
    expect(toBlindChips("-1259450.25", 100)).toEqual(ok(-125945025));
    expect(toBlindChips("0.25", 100)).toEqual(ok(25));
    expect(toBlindChips("0", 1)).toEqual(ok(0));
  });

  test("reports the post bet as written when its size does not convert", () => {
    expect(toBlindChips("-0.295", 100)).toEqual(
      err({ code: "not_integral", amount: "-0.295", scale: 100 })
    );
    expect(toBlindChips("-9007199254740992", 1)).toEqual(
      err({ code: "out_of_range", amount: "-9007199254740992", scale: 1 })
    );
  });
});
