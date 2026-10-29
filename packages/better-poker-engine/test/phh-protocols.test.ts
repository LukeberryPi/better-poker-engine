import { describe, expect, test } from "bun:test";

import { toAcpc, toPluribus, type Phh } from "../src/phh.ts";
import { err, ok } from "../src/result.ts";
import { parsed } from "./phh-support.ts";

function history(lines: readonly string[]): Phh {
  return parsed(lines.join("\n"));
}

function headsUp(
  actions: readonly string[],
  fields: readonly string[] = []
): Phh {
  return history([
    "variant = 'NT'",
    "antes = [0, 0]",
    "blinds_or_straddles = [1, 2]",
    "min_bet = 2",
    "starting_stacks = [200, 200]",
    `actions = [${actions.map((action) => `'${action}'`).join(", ")}]`,
    ...fields,
  ]);
}

const cents = history([
  "variant = 'NT'",
  "antes = [0, 0]",
  "blinds_or_straddles = [0.5, 1]",
  "min_bet = 1",
  "starting_stacks = [100, 100]",
  "actions = ['d dh p1 AcAd', 'd dh p2 KcKd', 'p2 cbr 2.5', 'p1 f']",
]);

describe("toAcpc and toPluribus", () => {
  test("fill hole cards dealt one at a time and mark each street once", () => {
    const dealtOneByOne = headsUp(
      [
        "d dh p1 Ac",
        "d dh p2 Kc",
        "d dh p1 Ad",
        "d dh p2 Kd",
        "p2 cc",
        "p1 cc",
        "d db 2c",
        "d db 3c",
        "d db 4c",
        "p1 cc",
        "p2 cc",
      ],
      ["hand = 1"]
    );
    expect(toAcpc(dealtOneByOne, 0)).toEqual(
      ok([
        ["S->", "MATCHSTATE:0:1::AcAd|\r\n"],
        ["S->", "MATCHSTATE:0:1:c:AcAd|\r\n"],
        ["<-C", "MATCHSTATE:0:1:c:AcAd|:c\r\n"],
        ["S->", "MATCHSTATE:0:1:cc/:AcAd|/2c3c4c\r\n"],
        ["<-C", "MATCHSTATE:0:1:cc/:AcAd|/2c3c4c:c\r\n"],
        ["S->", "MATCHSTATE:0:1:cc/c:AcAd|/2c3c4c\r\n"],
      ])
    );
    expect(toPluribus(dealtOneByOne)).toEqual(
      ok("STATE:1:cc/cc:AcAd|KcKd/2c3c4c:-2|-2:p1|p2")
    );
  });

  test("write amounts in the history's units", () => {
    const options = { handNumber: 3, amountScale: 100 } as const;
    expect(toAcpc(cents, 1, options)).toEqual(
      ok([
        ["S->", "MATCHSTATE:1:3::|KcKd\r\n"],
        ["<-C", "MATCHSTATE:1:3::|KcKd:r2.5\r\n"],
        ["S->", "MATCHSTATE:1:3:r2.5:|KcKd\r\n"],
        ["S->", "MATCHSTATE:1:3:r2.5f:|KcKd\r\n"],
      ])
    );
    expect(toPluribus(cents, options)).toEqual(
      ok("STATE:3:r2.5f:AcAd|KcKd:-1|1:p1|p2")
    );
  });

  test("report a history the replay refuses", () => {
    const refusal = {
      code: "not_integral",
      field: "blinds_or_straddles[0]",
    };
    expect(toAcpc(cents, 0, { handNumber: 3 })).toMatchObject(err(refusal));
    expect(toPluribus(cents, { handNumber: 3 })).toMatchObject(err(refusal));
  });

  test("take Pluribus results from finishing_stacks, as pokerkit does", () => {
    const folded = headsUp(
      ["d dh p1 AcAd", "d dh p2 KcKd", "p2 f"],
      ["hand = 1", "finishing_stacks = [210, 190]"]
    );
    expect(toPluribus(folded)).toEqual(ok("STATE:1:f:AcAd|KcKd:10|-10:p1|p2"));
  });

  test("refuse what the protocols cannot carry", () => {
    const folded = ["d dh p1 AcAd", "d dh p2 ????", "p2 f"];
    const potLimit = history([
      "variant = 'PO'",
      "antes = [0, 0]",
      "blinds_or_straddles = [1, 2]",
      "min_bet = 2",
      "starting_stacks = [200, 200]",
      "actions = []",
      "hand = 1",
    ]);
    expect(toAcpc(potLimit, 0)).toEqual(
      err({ code: "unsupported_variant", variant: "PO" })
    );
    const fixedLimit = history([
      "variant = 'FT'",
      "antes = [0, 0]",
      "blinds_or_straddles = [1, 2]",
      "small_bet = 2",
      "big_bet = 4",
      "starting_stacks = [200, 200]",
      "actions = []",
      "hand = 1",
    ]);
    expect(toPluribus(fixedLimit)).toEqual(
      err({ code: "unsupported_variant", variant: "FT" })
    );

    const unnumbered = headsUp(folded);
    expect(toAcpc(unnumbered, 0)).toEqual(
      err({ code: "hand_number_required" })
    );
    expect(toPluribus(headsUp(folded, ["hand = 'A1'"]))).toEqual(
      err({ code: "hand_number_required" })
    );

    expect(toAcpc(unnumbered, 2, { handNumber: 1 })).toEqual(
      err({ code: "unknown_position", position: 2 })
    );
    expect(toAcpc(unnumbered, -1, { handNumber: 1 })).toEqual(
      err({ code: "unknown_position", position: -1 })
    );
    const unknownHole = err({
      code: "hole_cards_unknown",
      position: 1,
    } as const);
    const flopNotDealt = headsUp([
      "d dh p1 AcAd",
      "d dh p2 ????",
      "p2 cc",
      "p1 cc",
    ]);
    expect(toAcpc(flopNotDealt, 1, { handNumber: 1 })).toEqual(unknownHole);
    const allInFromTheBlinds = history([
      "variant = 'NT'",
      "antes = [0, 0]",
      "blinds_or_straddles = [1, 2]",
      "min_bet = 2",
      "starting_stacks = [2, 1]",
      "actions = ['d dh p1 AcAd', 'd dh p2 ????', 'd db 2c3c4c', 'd db 5d', 'd db 6d']",
    ]);
    expect(toAcpc(allInFromTheBlinds, 1, { handNumber: 1 })).toEqual(
      unknownHole
    );

    const unbounded = history([
      "variant = 'NT'",
      "antes = [0, 0]",
      "blinds_or_straddles = [1, 2]",
      "min_bet = 2",
      "starting_stacks = [200, inf]",
      `actions = [${folded.map((action) => `'${action}'`).join(", ")}]`,
      "hand = 1",
    ]);
    expect(toPluribus(unbounded)).toEqual(
      err({ code: "unbounded_stack", position: 1 })
    );
  });
});
