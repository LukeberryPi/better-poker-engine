import { describe, expect, test } from "bun:test";

import {
  randomBelow,
  secureRandom,
  insecureSeededRandom,
  type RandomSource,
} from "../src/random.ts";
import { scripted } from "./support.ts";

const seed42 = [
  0xde_5d_75_55, 0x6a_7c_09_29, 0x56_72_67_34, 0x82_a3_3e_12, 0xe1_9a_bb_75,
];

function draws(random: RandomSource, count: number): number[] {
  return Array.from({ length: count }, () => random.nextUint32());
}

describe("insecureSeededRandom", () => {
  test("matches a reference sfc32 sequence", () => {
    expect(draws(insecureSeededRandom(42), 5)).toEqual(seed42);
  });

  test("gives seeds equal modulo 2 ** 32 the same sequence", () => {
    expect(draws(insecureSeededRandom(42 + 2 ** 32), 5)).toEqual(seed42);
    expect(draws(insecureSeededRandom(-1), 5)).toEqual(
      draws(insecureSeededRandom(2 ** 32 - 1), 5)
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

describe("secureRandom without Web Crypto", () => {
  test("throws when called, naming what is missing", () => {
    const webCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(() => secureRandom()).toThrow(/react-native-get-random-values/u);
    } finally {
      if (webCrypto !== undefined) {
        Object.defineProperty(globalThis, "crypto", webCrypto);
      }
    }
  });
});

describe("randomBelow", () => {
  test("redraws the values that would favour low results", () => {
    // 2 ** 32 % 3 === 1, so only 0xffffffff is redrawn for a bound of 3.
    expect(randomBelow(3, scripted([0xff_ff_ff_ff, 4]))).toBe(1);
    expect(randomBelow(3, scripted([0xff_ff_ff_fe]))).toBe(0xff_ff_ff_fe % 3);
  });
});
