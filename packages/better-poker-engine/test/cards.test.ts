import { describe, expect, test } from "bun:test";

import { decks, describeCard, parseCards, shuffle } from "../src/cards.ts";
import { seededRandom } from "../src/random.ts";
import { err, ok } from "../src/result.ts";
import { known, scripted } from "./support.ts";

describe("parseCards", () => {
  test("reads empty text as no cards", () => {
    expect(parseCards("")).toEqual(ok([]));
  });

  test("reads 10 as a ten", () => {
    expect(parseCards("10s Td")).toEqual(ok(["Ts", "Td"]));
  });

  test("reads cards whose suit or rank is unknown", () => {
    expect(parseCards("J? ??")).toEqual(ok(["J?", "??"]));
  });

  test("skips commas and line breaks between cards", () => {
    expect(parseCards("Ac,\nKd ,Qh")).toEqual(ok(["Ac", "Kd", "Qh"]));
  });

  test("separates cards where pokerkit's str.split() does", () => {
    expect(parseCards("Ac\u001cKd\u0085Qh")).toEqual(ok(["Ac", "Kd", "Qh"]));
    expect(parseCards("Ac\ufeffKd")).toEqual(
      err({ code: "invalid_card", at: 2, text: "\ufeffK" })
    );
  });

  test("rejects a known suit on an unknown rank", () => {
    expect(parseCards("As ?s")).toEqual(
      err({ code: "invalid_card", at: 3, text: "?s" })
    );
  });

  test("rejects a rank split from its suit", () => {
    expect(parseCards("A s")).toEqual(
      err({ code: "invalid_card", at: 0, text: "A" })
    );
  });

  test("points at the first invalid card", () => {
    expect(parseCards("AcKdQx2c")).toEqual(
      err({ code: "invalid_card", at: 4, text: "Qx" })
    );
  });
});

describe("describeCard", () => {
  test("names unknown ranks and suits as pokerkit does", () => {
    expect(describeCard("??")).toBe("UNKNOWN OF UNKNOWNS (??)");
  });
});

describe("shuffle", () => {
  test("returns a reordering of the same cards", () => {
    const shuffled = shuffle(decks.standard, seededRandom(7));
    expect(shuffled.toSorted()).toEqual(decks.standard.toSorted());
    expect(shuffled).not.toEqual(decks.standard);
  });

  test("draws each next card from the cards still unplaced", () => {
    const random = scripted([0xffffffff, 4, 1, 0]);
    expect(shuffle(known("AcAdAh"), random)).toEqual(known("AdAhAc"));
  });

  test("makes every order of three cards about equally likely", () => {
    const random = seededRandom(2026);
    const trials = 60_000;
    const counts = new Map<string, number>();
    for (let trial = 0; trial < trials; trial += 1) {
      const order = shuffle(known("AcAdAh"), random).join("");
      counts.set(order, (counts.get(order) ?? 0) + 1);
    }
    const expected = trials / 6;
    const chiSquare = [...counts.values()].reduce(
      (sum, count) => sum + (count - expected) ** 2 / expected,
      0
    );
    expect(counts.size).toBe(6);
    // The 99.9th percentile of chi-square with 5 degrees of freedom.
    expect(chiSquare).toBeLessThan(20.52);
  });
});
