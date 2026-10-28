import { expect } from "bun:test";

import { doctest, unitTest } from "../../../../parity/harness.ts";
import type { Range } from "../../src/analysis.ts";
import { known, range, sortedCombos } from "../support.ts";

/** pokerkit's `frozenset(Card.parse(text)) in rng`. */
function contains(rng: Range, text: string): boolean {
  const combos = sortedCombos(rng);
  return sortedCombos([known(text)]).every((combo) => combos.includes(combo));
}

/** pokerkit's `assertSetEqual` on a range and its combinations. */
function expectCombos(actual: Range, expected: readonly string[]): void {
  expect(sortedCombos(actual)).toEqual(sortedCombos(expected.map(known)));
}

doctest("pokerkit.analysis.parse_range", (example) => {
  let rng: Range = [];
  example(1, () => {
    rng = range("AKs");
  });
  example(2, () => expect(rng).toHaveLength(4));
  example(3, () => expect(contains(rng, "AsKs")).toBe(true));
  example(4, () => expect(contains(rng, "AcKd")).toBe(false));
});

unitTest(
  "pokerkit.tests.test_analysis.HandHistoryTestCase.test_parse_range",
  () => {
    expectCombos(range("JJ"), ["JcJd", "JcJh", "JcJs", "JdJh", "JdJs", "JhJs"]);
    expectCombos(range("AK"), [
      "AcKd",
      "AcKh",
      "AcKs",
      "AdKc",
      "AdKh",
      "AdKs",
      "AhKc",
      "AhKd",
      "AhKs",
      "AsKc",
      "AsKd",
      "AsKh",
      "AcKc",
      "AdKd",
      "AhKh",
      "AsKs",
    ]);
    expectCombos(range("QJs"), ["QcJc", "QdJd", "QhJh", "QsJs"]);
    expectCombos(range("QTs"), ["QcTc", "QdTd", "QhTh", "QsTs"]);
    expectCombos(range("AKo"), [
      "AcKd",
      "AcKh",
      "AcKs",
      "AdKc",
      "AdKh",
      "AdKs",
      "AhKc",
      "AhKd",
      "AhKs",
      "AsKc",
      "AsKd",
      "AsKh",
    ]);
    expectCombos(range("JJ+"), [
      "JcJd",
      "JcJh",
      "JcJs",
      "JdJh",
      "JdJs",
      "JhJs",
      "QcQd",
      "QcQh",
      "QcQs",
      "QdQh",
      "QdQs",
      "QhQs",
      "KcKd",
      "KcKh",
      "KcKs",
      "KdKh",
      "KdKs",
      "KhKs",
      "AcAd",
      "AcAh",
      "AcAs",
      "AdAh",
      "AdAs",
      "AhAs",
    ]);
    expectCombos(range("QT+"), [
      "QcTd",
      "QcTh",
      "QcTs",
      "QdTc",
      "QdTh",
      "QdTs",
      "QhTc",
      "QhTd",
      "QhTs",
      "QsTc",
      "QsTd",
      "QsTh",
      "QcTc",
      "QdTd",
      "QhTh",
      "QsTs",
      "QcJd",
      "QcJh",
      "QcJs",
      "QdJc",
      "QdJh",
      "QdJs",
      "QhJc",
      "QhJd",
      "QhJs",
      "QsJc",
      "QsJd",
      "QsJh",
      "QcJc",
      "QdJd",
      "QhJh",
      "QsJs",
    ]);
    expectCombos(range("JTs+"), ["JcTc", "JdTd", "JhTh", "JsTs"]);
    expectCombos(range("JTo+"), [
      "JcTd",
      "JcTh",
      "JcTs",
      "JdTc",
      "JdTh",
      "JdTs",
      "JhTc",
      "JhTd",
      "JhTs",
      "JsTc",
      "JsTd",
      "JsTh",
    ]);
    expectCombos(range("JJ-TT"), [
      "JcJd",
      "JcJh",
      "JcJs",
      "JdJh",
      "JdJs",
      "JhJs",
      "TcTd",
      "TcTh",
      "TcTs",
      "TdTh",
      "TdTs",
      "ThTs",
    ]);
    expectCombos(range("JTs-KQs"), [
      "JcTc",
      "JdTd",
      "JhTh",
      "JsTs",
      "QcJc",
      "QdJd",
      "QhJh",
      "QsJs",
      "KcQc",
      "KdQd",
      "KhQh",
      "KsQs",
    ]);
    expectCombos(range("AsKh"), ["AsKh"]);
    expectCombos(range("2s3s"), ["2s3s"]);
    expectCombos(range("4s5h;2s3s"), ["4s5h", "2s3s"]);
    expectCombos(range("7s8s 27         AK", "ATs+"), [
      "7s8s",
      "2c7d",
      "2c7h",
      "2c7s",
      "2d7c",
      "2d7h",
      "2d7s",
      "2h7c",
      "2h7d",
      "2h7s",
      "2s7c",
      "2s7d",
      "2s7h",
      "2c7c",
      "2d7d",
      "2h7h",
      "2s7s",
      "AcKd",
      "AcKh",
      "AcKs",
      "AdKc",
      "AdKh",
      "AdKs",
      "AhKc",
      "AhKd",
      "AhKs",
      "AsKc",
      "AsKd",
      "AsKh",
      "AcKc",
      "AdKd",
      "AhKh",
      "AsKs",
      "AcQc",
      "AdQd",
      "AhQh",
      "AsQs",
      "AcJc",
      "AdJd",
      "AhJh",
      "AsJs",
      "AcTc",
      "AdTd",
      "AhTh",
      "AsTs",
    ]);
    expectCombos(range("99+", "2h7s"), [
      "9c9d",
      "9c9h",
      "9c9s",
      "9d9h",
      "9d9s",
      "9h9s",
      "TcTd",
      "TcTh",
      "TcTs",
      "TdTh",
      "TdTs",
      "ThTs",
      "JcJd",
      "JcJh",
      "JcJs",
      "JdJh",
      "JdJs",
      "JhJs",
      "QcQd",
      "QcQh",
      "QcQs",
      "QdQh",
      "QdQs",
      "QhQs",
      "KcKd",
      "KcKh",
      "KcKs",
      "KdKh",
      "KdKs",
      "KhKs",
      "AcAd",
      "AcAh",
      "AcAs",
      "AdAh",
      "AdAs",
      "AhAs",
      "2h7s",
    ]);
  }
);
