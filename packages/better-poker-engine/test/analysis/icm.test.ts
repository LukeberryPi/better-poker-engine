import { describe, expect, test } from "bun:test";

import { icm } from "../../src/analysis.ts";
import { randomBelow, seededRandom } from "../../src/random.ts";
import { err, ok } from "../../src/result.ts";
import { okValue } from "../support.ts";

/** `itertools.permutations(items, size)`, in its order. */
function permutations<T>(items: readonly T[], size: number): (readonly T[])[] {
  if (size === 0) return [[]];
  return items.flatMap((item, index) =>
    permutations(items.toSpliced(index, 1), size - 1).map((rest) => [
      item,
      ...rest,
    ])
  );
}

/** pokerkit's `calculate_icm`, transcribed line by line. */
function transcribedIcm(
  payouts: readonly number[],
  chips: readonly number[]
): number[] {
  const chipSum = chips.reduce((sum, chip) => sum + chip, 0);
  const players = chips.map((chip) => ({
    chipPercentage: chip / chipSum,
    icm: 0,
  }));
  for (const order of permutations(players, payouts.length)) {
    let probability = 1;
    let denominator = 1;
    for (const player of order) {
      probability *= player.chipPercentage / denominator;
      denominator -= player.chipPercentage;
    }
    for (const [place, player] of order.entries()) {
      player.icm += (payouts[place] ?? Number.NaN) * probability;
    }
  }
  return players.map((player) => player.icm);
}

describe("icm", () => {
  test("matches a line-by-line transcription of pokerkit to the last bit", () => {
    const random = seededRandom(13);
    for (let table = 0; table < 300; table += 1) {
      const players = 1 + randomBelow(6, random);
      const stacks = Array.from(
        { length: players },
        () => 1 + randomBelow(10_000, random)
      );
      const payouts = Array.from(
        { length: randomBelow(players + 1, random) },
        () => randomBelow(1000, random) / 7
      );
      expect(icm(payouts, stacks)).toEqual(ok(transcribedIcm(payouts, stacks)));
    }
  });

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

  test("values players with chips as pokerkit would without the others", () => {
    const random = seededRandom(29);
    for (let table = 0; table < 300; table += 1) {
      const stacks = Array.from(
        { length: 1 + randomBelow(6, random) },
        (_, player) =>
          player > 0 && randomBelow(3, random) === 0
            ? 0
            : 1 + randomBelow(10_000, random)
      );
      const payouts = Array.from(
        { length: randomBelow(8, random) },
        () => randomBelow(1000, random) / 7
      );
      const holders = stacks.filter((stack) => stack > 0);
      const values = okValue(icm(payouts, stacks));
      expect(values.filter((_, player) => stacks[player] !== 0)).toEqual(
        transcribedIcm(payouts.slice(0, holders.length), holders)
      );
    }
  });

  test("pays only as many places as there are players", () => {
    expect(icm([50, 30, 20], [10, 10])).toEqual(ok([40, 40]));
    expect(icm([50], [])).toEqual(ok([]));
  });

  test("gives players without chips nothing while others can take the places", () => {
    expect(icm([70], [100, 0])).toEqual(ok([70, 0]));
    expect(icm([50, 30], [50, 50, 0])).toEqual(ok([40, 40, 0]));
    expect(icm([], [10, 20])).toEqual(ok([0, 0]));
  });

  test("places players without chips last, sharing the places left evenly", () => {
    expect(icm([70, 30], [100, 0])).toEqual(ok([70, 30]));
    expect(icm([50, 30, 20], [50, 50, 0])).toEqual(ok([40, 40, 20]));
    expect(icm([50, 30, 20], [100, 0])).toEqual(ok([50, 30]));
    expect(icm([40, 30, 20, 10], [1, 0, 0, 0])).toEqual(ok([40, 20, 20, 20]));
    const [first, second, third] = okValue(icm([50, 30, 20], [1, 2, 0]));
    expect(first).toBeCloseTo(110 / 3, 12);
    expect(second).toBeCloseTo(130 / 3, 12);
    expect(third).toBe(20);
  });

  test("finds no chips left where pokerkit divides by zero", () => {
    expect(icm([70, 30], [0, 0])).toEqual(err({ code: "no_chips_left" }));
    expect(icm([], [0])).toEqual(err({ code: "no_chips_left" }));
    expect(icm([50, 30, 20], [2 ** 53 - 1, 1, 1])).toEqual(
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
