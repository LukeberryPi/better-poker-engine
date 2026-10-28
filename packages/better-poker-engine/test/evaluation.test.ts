import { describe, expect, test } from "bun:test";

import { evaluate } from "../src/evaluation.ts";
import { cards, known } from "./support.ts";

describe("evaluate", () => {
  test("keeps the first of equally strong card sets, as pokerkit does", () => {
    const value = evaluate("standardHigh", cards("AsAc"), cards("AhAdKcKh2s"));
    expect(value?.cards).toEqual(known("AsAcAhAdKc"));
  });

  test("is null while any card is not fully known", () => {
    expect(evaluate("standardHigh", cards("AsKs"), cards("QsJsTs9s??"))).toBe(
      null
    );
    expect(evaluate("standardHigh", cards("AsK?"), cards("QsJsTs9s"))).toBe(
      null
    );
  });

  test("is null when the cards are too few for a hand", () => {
    expect(evaluate("standardHigh", cards("AsKs"), cards("QsJs"))).toBe(null);
  });
});
