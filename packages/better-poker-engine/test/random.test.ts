import { describe, expect, test } from "bun:test";

import {
  randomBelow,
  secureRandom,
  seededRandom,
  type RandomSource,
} from "../src/random.ts";
import { scripted } from "./support.ts";

const seed42 = [0xde5d7555, 0x6a7c0929, 0x56726734, 0x82a33e12, 0xe19abb75];

function draws(random: RandomSource, count: number): number[] {
  return Array.from({ length: count }, () => random.nextUint32());
}

describe("seededRandom", () => {
  test("matches a reference sfc32 sequence", () => {
    expect(draws(seededRandom(42), 5)).toEqual(seed42);
  });

  test("gives seeds equal modulo 2 ** 32 the same sequence", () => {
    expect(draws(seededRandom(42 + 2 ** 32), 5)).toEqual(seed42);
    expect(draws(seededRandom(-1), 5)).toEqual(
      draws(seededRandom(2 ** 32 - 1), 5)
    );
  });
});

describe("secureRandom", () => {
  test("yields varying unsigned 32-bit integers", () => {
    const values = draws(secureRandom(), 64);
    const outOfRange = values.filter(
      (value) => !Number.isInteger(value) || value < 0 || value >= 2 ** 32
    );
    expect(outOfRange).toEqual([]);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});

describe("randomBelow", () => {
  test("redraws the values that would favour low results", () => {
    // 2 ** 32 % 3 === 1, so only 0xffffffff is redrawn for a bound of 3.
    expect(randomBelow(3, scripted([0xffffffff, 4]))).toBe(1);
    expect(randomBelow(3, scripted([0xfffffffe]))).toBe(0xfffffffe % 3);
  });
});
