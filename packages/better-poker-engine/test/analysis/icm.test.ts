import { describe, expect, test } from "bun:test";

import { icm } from "../../src/analysis.ts";
import { err, ok } from "../../src/result.ts";
import { okValue } from "../support.ts";

describe("icm", () => {
  test("matches the exact fractions of pokerkit's first example", () => {
    const [first, second, third] = okValue(icm([70, 30], [50, 30, 20]));
    expect(first).toBeCloseTo(1265 / 28, 12);
    expect(second).toBe(129 / 4);
    expect(third).toBeCloseTo(158 / 7, 12);
  });

  test("pays heads-up by chip share", () => {
    expect(icm([70, 30], [600, 400])).toEqual(ok([54, 46]));
  });

  test("splits the prize pool evenly between equal stacks", () => {
    for (const value of okValue(icm([50, 30, 20], [10, 10, 10]))) {
      expect(value).toBeCloseTo(100 / 3, 12);
    }
  });

  test("hands out every payout when places do not outnumber players", () => {
    const stacks = [9000, 7000, 5500, 4000, 2500, 1000];
    const values = okValue(icm([50, 25, 15, 10], stacks));
    expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 9);
    expect(values).toEqual(values.toSorted((a, b) => b - a));
  });

  test("takes any numbers as payouts", () => {
    expect(icm([0.5, -0.25], [1, 1])).toEqual(ok([0.125, 0.125]));
  });

  test("pays nothing, as pokerkit, when payouts outnumber players", () => {
    expect(icm([50, 30, 20], [10, 20])).toEqual(ok([0, 0]));
    expect(icm([50, 30, 20], [100, 0])).toEqual(ok([0, 0]));
    expect(icm([50], [])).toEqual(ok([]));
  });

  test("gives players without chips nothing while others can take the places", () => {
    expect(icm([70], [100, 0])).toEqual(ok([70, 0]));
    expect(icm([50, 30], [50, 50, 0])).toEqual(ok([40, 40, 0]));
    expect(icm([], [10, 20])).toEqual(ok([0, 0]));
  });

  test("rejects places that only players without chips could take", () => {
    expect(icm([70, 30], [0, 0])).toEqual(err({ code: "no_chips_left" }));
    expect(icm([], [0])).toEqual(err({ code: "no_chips_left" }));
    expect(icm([70, 30], [100, 0])).toEqual(err({ code: "no_chips_left" }));
    expect(icm([50, 30, 20], [50, 50, 0])).toEqual(
      err({ code: "no_chips_left" })
    );
  });

  test("rejects stacks that are not whole numbers of chips", () => {
    for (const stack of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(icm([70, 30], [100, stack])).toEqual(
        err({ code: "invalid_stack", player: 1, stack })
      );
    }
  });
});
