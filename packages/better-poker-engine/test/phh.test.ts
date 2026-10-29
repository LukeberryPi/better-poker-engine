import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import { formatPhhAction } from "../src/phh-actions.ts";
import {
  formatPhh,
  formatPhhs,
  parsePhh,
  parsePhhs,
  type Phh,
} from "../src/phh.ts";
import { err, ok } from "../src/result.ts";
import { variantCodes } from "../src/variants.ts";

const fixtures = new URL("fixtures/phh/", import.meta.url);

function fixture(path: string): string {
  return readFileSync(new URL(path, fixtures), "utf8");
}

const wsopFiles = readdirSync(new URL("wsop/", fixtures)).map(
  (name) => `wsop/${name}`
);
const annotatedFiles = [
  "dwan-ivey-2009.phh",
  "phua-xuan-2019.phh",
  "antonius-blom-2009.phh",
  "arieh-yockey-2019.phh",
  "alice-carol-wikipedia.phh",
];

function history(text: string): Phh {
  const parsed = parsePhh(text);
  if (!parsed.ok) {
    throw new Error(`Test history does not parse: ${JSON.stringify(parsed)}`);
  }
  return parsed.value;
}

function withoutTrailingZeros(text: string): string {
  return text.replace(
    /(\d+)\.(\d*?)0+(?=\D|$)/gu,
    (_match, whole: string, fraction: string) =>
      fraction === "" ? whole : `${whole}.${fraction}`
  );
}

const noLimit = [
  "variant = 'NT'",
  "antes = [0, 0]",
  "blinds_or_straddles = [1, 2]",
  "min_bet = 2",
  "starting_stacks = [200, 200]",
  "actions = ['d dh p1 AcAd', 'd dh p2 KcKd', 'p1 cbr 6', 'p2 cc']",
].join("\n");

const fixedLimit = [
  "variant = 'FT'",
  "antes = [0, 0]",
  "blinds_or_straddles = [1, 2]",
  "small_bet = 2",
  "big_bet = 4",
  "starting_stacks = [200, 200]",
  "actions = []",
].join("\n");

const stud = [
  "variant = 'F7S'",
  "antes = [1, 1]",
  "bring_in = 1",
  "small_bet = 2",
  "big_bet = 4",
  "starting_stacks = [200, 200]",
  "actions = []",
].join("\n");

describe("phh-dataset files", () => {
  test("pokerkit's own output round-trips byte for byte", () => {
    expect(wsopFiles).toHaveLength(9);
    for (const file of wsopFiles) {
      const text = fixture(file);
      expect({ file, text: formatPhh(history(text)) }).toEqual({ file, text });
    }
  });

  test("hand-annotated files keep their data through a round trip", () => {
    for (const file of annotatedFiles) {
      const parsed = history(fixture(file));
      const written = formatPhh(parsed);
      expect({ file, history: history(written) }).toEqual({
        file,
        history: parsed,
      });
      expect(formatPhh(history(written))).toBe(written);
    }
  });

  test("the fixtures cover every variant", () => {
    const variants = [...wsopFiles, ...annotatedFiles].map(
      (file) => history(fixture(file)).variant
    );
    expect(new Set(variants)).toEqual(new Set(variantCodes));
  });

  test("a stud history reads into typed fields", () => {
    const parsed = history(fixture("wsop/00-22-43.phh"));
    expect({ ...parsed, actions: parsed.actions.slice(0, 6) }).toEqual({
      variant: "F7S",
      anteTrimming: true,
      antes: ["50000", "50000", "50000", "50000", "50000"],
      blinds: null,
      bringIn: "50000",
      smallBet: "200000",
      bigBet: "400000",
      minBet: null,
      startingStacks: ["4050000", "7750000", "4825000", "8525000", "4550000"],
      actions: [
        {
          type: "dealHole",
          player: 1,
          cards: ["Td", "3c", "4d"],
          commentary: null,
        },
        {
          type: "dealHole",
          player: 2,
          cards: ["Kd", "3h", "4c"],
          commentary: null,
        },
        {
          type: "dealHole",
          player: 3,
          cards: ["As", "8d", "5c"],
          commentary: null,
        },
        {
          type: "dealHole",
          player: 4,
          cards: ["8c", "5s", "Qc"],
          commentary: null,
        },
        {
          type: "dealHole",
          player: 5,
          cards: ["Kc", "8s", "3s"],
          commentary: null,
        },
        { type: "postBringIn", player: 5, commentary: null },
      ],
      author: "Juho Kim",
      event:
        "2023 World Series of Poker Event #43: $50,000 Poker Players Championship | Day 5",
      url: null,
      venue: null,
      address: null,
      city: "Las Vegas",
      region: "Nevada",
      postalCode: null,
      country: "United States of America",
      time: null,
      timeZone: null,
      timeZoneAbbreviation: null,
      day: 22,
      month: 6,
      year: 2023,
      hand: { kind: "integer", value: 5 },
      level: null,
      seats: null,
      seatCount: null,
      table: null,
      players: [
        "James Obst",
        "Talal Shakerchi",
        "Brian Rast",
        "Matthew Ashton",
        "Kristopher Tong",
      ],
      finishingStacks: ["4000000", "7700000", "4775000", "8275000", "4950000"],
      winnings: null,
      currency: null,
      currencySymbol: null,
      timeLimit: null,
      timeBanks: null,
      extra: {},
    });
    expect(parsed.actions).toHaveLength(20);
  });

  test("decimal amounts read as canonical decimals", () => {
    const parsed = history(fixture("antonius-blom-2009.phh"));
    expect(parsed.startingStacks).toEqual(["1259450.25", "678473.5"]);
  });
});

describe("parsePhhs", () => {
  const text = fixture("handhq-ps-25nlh-1-30.phhs");

  test("reads every history in order and writes them back", () => {
    const parsed = parsePhhs(text);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    expect(parsed.value).toHaveLength(30);
    expect(parsed.value.map((item) => item.hand).slice(0, 2)).toEqual([
      { kind: "integer", value: 59937794410 },
      { kind: "integer", value: 59937793662 },
    ]);
    const written = formatPhhs(parsed.value);
    expect(parsePhhs(written)).toEqual(parsed);
    expect(written.startsWith("[1]\nvariant = 'NT'\n")).toBe(true);
    expect(written).toContain("\n\n[30]\nvariant = 'NT'\n");
  });

  test("keeps pokerkit's layout, losing only the trailing zeros of floats", () => {
    const parsed = parsePhhs(text);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    const sections = text
      .trimEnd()
      .split("\n\n")
      .map((section) => section.replace(/^\[\d+\]\n/u, ""));
    expect(parsed.value.map(formatPhh)).toEqual(
      sections.map(withoutTrailingZeros)
    );
  });

  test("reads the metadata online histories carry", () => {
    const parsed = parsePhhs(text);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    const [first] = parsed.value;
    expect(first).toMatchObject({
      blinds: ["0.1", "0.25", "0", "0"],
      startingStacks: ["25", "54.75", "16.35", "24.65"],
      venue: "PokerStars",
      time: { hour: 0, minute: 0, second: 0, millisecond: 0 },
      timeZoneAbbreviation: "ET",
      seats: [2, 4, 5, 6],
      seatCount: 6,
      table: { kind: "string", value: "vgLbwVmy1dOb81ICg4y5+Q" },
      currencySymbol: "$",
      extra: {},
    });
  });

  test("keeps pokerkit's negative post bets in the blinds", () => {
    const parsed = parsePhhs(text);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    expect(parsed.value[8]?.blinds).toEqual(["0.1", "0.25", "-0.25", "0", "0"]);
  });

  test("names the table of the history that fails", () => {
    expect(parsePhhs(`[a]\n${noLimit}\n\n[b]\nvariant = 'X'`)).toEqual(
      err({ code: "unknown_variant", variant: "X", document: "b" })
    );
    expect(parsePhhs("loose = 1")).toEqual(
      err({
        code: "schema",
        issues: [{ path: "", message: "expected a table" }],
        document: "loose",
      })
    );
  });

  test("reads an empty file as no histories", () => {
    expect(parsePhhs("")).toEqual(ok([]));
    expect(formatPhhs([])).toBe("");
  });
});

describe("user-defined fields", () => {
  const userFields = [
    "_sponsors = ['PokerStars', 'Full Tilt']",
    "nationality = 'CA'",
    "_count = 3",
    "_ratio = 3.0",
    "_floats = [inf, -inf, nan, -0.0, 1e21, 0.1]",
    "_at = 1979-05-27T07:32:00-08:00",
    "_on = 1979-05-27",
    "_local = 1979-05-27T07:32:00",
    "_clock = 07:32:00",
    "_flags = [true, false]",
    '"my key" = "line\\nbreak"',
    "_meta = { source = 'x', nested = { depth = 2 } }",
  ];
  const parsed = history([noLimit, ...userFields].join("\n"));

  test("keep their TOML types, with or without a leading underscore", () => {
    expect(parsed.extra).toEqual({
      _sponsors: {
        type: "array",
        value: [
          { type: "string", value: "PokerStars" },
          { type: "string", value: "Full Tilt" },
        ],
      },
      nationality: { type: "string", value: "CA" },
      _count: { type: "integer", value: "3" },
      _ratio: { type: "float", value: "3" },
      _floats: {
        type: "array",
        value: [
          { type: "float", value: "inf" },
          { type: "float", value: "-inf" },
          { type: "float", value: "nan" },
          { type: "float", value: "-0" },
          { type: "float", value: "1e+21" },
          { type: "float", value: "0.1" },
        ],
      },
      _at: { type: "datetime", value: "1979-05-27T07:32:00.000-08:00" },
      _on: { type: "datetime", value: "1979-05-27" },
      _local: { type: "datetime", value: "1979-05-27T07:32:00.000" },
      _clock: { type: "datetime", value: "07:32:00.000" },
      _flags: {
        type: "array",
        value: [
          { type: "boolean", value: true },
          { type: "boolean", value: false },
        ],
      },
      "my key": { type: "string", value: "line\nbreak" },
      _meta: {
        type: "table",
        value: {
          source: { type: "string", value: "x" },
          nested: {
            type: "table",
            value: { depth: { type: "integer", value: "2" } },
          },
        },
      },
    });
  });

  test("are written back after the standard fields", () => {
    expect(formatPhh(parsed)).toBe(
      [
        noLimit,
        "_sponsors = ['PokerStars', 'Full Tilt']",
        "nationality = 'CA'",
        "_count = 3",
        "_ratio = 3.0",
        "_floats = [inf, -inf, nan, -0.0, 1e+21, 0.1]",
        "_at = 1979-05-27T07:32:00.000-08:00",
        "_on = 1979-05-27",
        "_local = 1979-05-27T07:32:00.000",
        "_clock = 07:32:00.000",
        "_flags = [true, false]",
        "'my key' = \"line\\nbreak\"",
        "_meta = {source = 'x', nested = {depth = 2}}",
      ].join("\n")
    );
    expect(history(formatPhh(parsed))).toEqual(parsed);
  });

  test("may be named __proto__", () => {
    const named = history(`${noLimit}\n"__proto__" = 1`);
    expect(Object.hasOwn(named.extra, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(named.extra)).toBe(Object.prototype);
    expect(formatPhh(named).endsWith("\n__proto__ = 1")).toBe(true);
  });
});

describe("parsePhh errors", () => {
  test("reports malformed TOML with its position", () => {
    expect(parsePhh("variant = 'NT")).toEqual(
      err({
        code: "toml",
        line: 1,
        column: 11,
        message: "unfinished string",
      })
    );
  });

  test("reports a missing, untyped or unknown variant", () => {
    expect(parsePhh("antes = [0]")).toEqual(
      err({
        code: "schema",
        issues: [{ path: "variant", message: "missing" }],
      })
    );
    expect(parsePhh("variant = 1")).toEqual(
      err({
        code: "schema",
        issues: [{ path: "variant", message: "expected a string" }],
      })
    );
    expect(parsePhh(noLimit.replace("'NT'", "'NLHE'"))).toEqual(
      err({ code: "unknown_variant", variant: "NLHE" })
    );
  });

  test("requires the fields of each betting structure", () => {
    expect(parsePhh(noLimit.replace("min_bet = 2\n", ""))).toEqual(
      err({ code: "schema", issues: [{ path: "min_bet", message: "missing" }] })
    );
    expect(parsePhh(fixedLimit.replace("small_bet = 2\n", ""))).toEqual(
      err({
        code: "schema",
        issues: [{ path: "small_bet", message: "missing" }],
      })
    );
    expect(parsePhh(stud.replace("bring_in = 1\n", ""))).toEqual(
      err({
        code: "schema",
        issues: [{ path: "bring_in", message: "missing" }],
      })
    );
  });

  test("rejects standard fields the variant does not use", () => {
    expect(parsePhh(`${fixedLimit}\nmin_bet = 2`)).toEqual(
      err({
        code: "schema",
        issues: [{ path: "min_bet", message: "not a field of FT histories" }],
      })
    );
    expect(parsePhh(`${stud}\nblinds_or_straddles = [0, 0]`)).toEqual(
      err({
        code: "schema",
        issues: [
          {
            path: "blinds_or_straddles",
            message: "not a field of F7S histories",
          },
        ],
      })
    );
    expect(parsePhh(`${noLimit}\nbring_in = 1`)).toEqual(
      err({
        code: "schema",
        issues: [{ path: "bring_in", message: "not a field of NT histories" }],
      })
    );
  });

  test("rejects amounts the spec rules out", () => {
    const cases = [
      [
        "starting_stacks = [200, 200]",
        "starting_stacks = [200, 0]",
        "starting_stacks[1]",
        "expected a positive number or inf",
      ],
      [
        "starting_stacks = [200, 200]",
        "starting_stacks = [200, -inf]",
        "starting_stacks[1]",
        "expected a positive number or inf",
      ],
      [
        "antes = [0, 0]",
        "antes = [0, -1]",
        "antes[1]",
        "expected a non-negative number",
      ],
      [
        "antes = [0, 0]",
        "antes = [0, nan]",
        "antes[1]",
        "expected a non-negative number",
      ],
      [
        "antes = [0, 0]",
        "antes = [0, '1']",
        "antes[1]",
        "expected a non-negative number",
      ],
      ["min_bet = 2", "min_bet = 0", "min_bet", "expected a positive number"],
      [
        "blinds_or_straddles = [1, 2]",
        "blinds_or_straddles = [1, inf]",
        "blinds_or_straddles[1]",
        "expected a number",
      ],
    ] as const;
    for (const [field, replacement, path, message] of cases) {
      expect(parsePhh(noLimit.replace(field, replacement))).toEqual(
        err({ code: "schema", issues: [{ path, message }] })
      );
    }
  });

  test("reads inf as an unbounded stack or time limit", () => {
    const parsed = history(
      `${noLimit.replace("[200, 200]", "[200, inf]")}\ntime_limit = inf`
    );
    expect(parsed.startingStacks).toEqual(["200", "unbounded"]);
    expect(parsed.timeLimit).toBe("unbounded");
    expect(formatPhh(parsed)).toContain("starting_stacks = [200, inf]");
  });

  test("requires one entry per player in per-player arrays", () => {
    expect(
      parsePhh(
        `${noLimit.replace("antes = [0, 0]", "antes = [0]")}\nplayers = ['a', 'b', 'c']`
      )
    ).toEqual(
      err({
        code: "schema",
        issues: [
          { path: "antes", message: "expected 2 entries, one per player" },
          { path: "players", message: "expected 2 entries, one per player" },
        ],
      })
    );
  });

  test("checks the types of optional fields", () => {
    const cases = [
      ["month = 13", "month", "expected an integer from 1 to 12"],
      ["day = 5.0", "day", "expected an integer from 1 to 31"],
      ["time = '12:00:00'", "time", "expected a local time such as 12:34:56"],
      ["time = 2020-01-01", "time", "expected a local time such as 12:34:56"],
      [
        "hand = 12345678901234567890",
        "hand",
        "expected a string or an integer from -9007199254740991 to 9007199254740991",
      ],
      ["players = ['a', 1]", "players[1]", "expected a string"],
      [
        "ante_trimming_status = 'yes'",
        "ante_trimming_status",
        "expected a boolean",
      ],
      ["seats = 1", "seats", "expected an array"],
    ] as const;
    for (const [line, path, message] of cases) {
      expect(parsePhh(`${noLimit}\n${line}`)).toEqual(
        err({ code: "schema", issues: [{ path, message }] })
      );
    }
  });

  test("lists every schema issue at once", () => {
    expect(
      parsePhh(`${noLimit.replace("min_bet = 2", "min_bet = -2")}\nmonth = 0`)
    ).toEqual(
      err({
        code: "schema",
        issues: [
          { path: "month", message: "expected an integer from 1 to 12" },
          { path: "min_bet", message: "expected a positive number" },
        ],
      })
    );
  });

  test("points at the first action that does not parse", () => {
    expect(parsePhh(noLimit.replace("'p1 cbr 6'", "'p1 raise 6'"))).toEqual(
      err({ code: "action_syntax", index: 2, text: "p1 raise 6" })
    );
  });

  test("reports schema issues before action syntax", () => {
    expect(
      parsePhh(
        noLimit
          .replace("'p1 cbr 6'", "'p1 raise 6'")
          .replace("min_bet = 2\n", "")
      )
    ).toEqual(
      err({ code: "schema", issues: [{ path: "min_bet", message: "missing" }] })
    );
  });
});

describe("formatPhh", () => {
  const base = history(noLimit);

  test("writes the standard fields in pokerkit's order", () => {
    const written = formatPhh({
      ...base,
      anteTrimming: false,
      author: "O'Neil",
      event: "Line one\nline two",
      time: { hour: 9, minute: 5, second: 0, millisecond: 7 },
      timeZone: "America/Toronto",
      timeZoneAbbreviation: "EDT",
      hand: { kind: "string", value: "A-1" },
      table: { kind: "integer", value: 3 },
      players: ["a'''b", "Bob"],
      timeLimit: "unbounded",
      timeBanks: ["30", "12.5"],
      extra: { _note: { type: "string", value: "x" } },
    });
    expect(written).toBe(
      [
        "variant = 'NT'",
        "ante_trimming_status = false",
        "antes = [0, 0]",
        "blinds_or_straddles = [1, 2]",
        "min_bet = 2",
        "starting_stacks = [200, 200]",
        "actions = ['d dh p1 AcAd', 'd dh p2 KcKd', 'p1 cbr 6', 'p2 cc']",
        "author = '''O'Neil'''",
        'event = "Line one\\nline two"',
        "time = 09:05:00.007",
        "time_zone = 'America/Toronto'",
        "hand = 'A-1'",
        "table = 3",
        "players = [\"a'''b\", 'Bob']",
        "time_limit = inf",
        "time_banks = [30, 12.5]",
        "time_zone_abbreviation = 'EDT'",
        "_note = 'x'",
      ].join("\n")
    );
    expect(history(written)).toMatchObject({
      author: "O'Neil",
      event: "Line one\nline two",
      players: ["a'''b", "Bob"],
      time: { hour: 9, minute: 5, second: 0, millisecond: 7 },
    });
  });

  test("writes hand-built amounts and actions in canonical form", () => {
    if (base.minBet === null)
      throw new Error("The base history has no min_bet");
    const written = formatPhh({
      ...base,
      antes: ["1e1", "0.50"],
      minBet: "2.0",
      actions: [
        { type: "betOrRaiseTo", player: 1, amount: "06", commentary: "open" },
      ],
    });
    expect(written).toContain("antes = [10, 0.5]");
    expect(written).toContain("min_bet = 2\n");
    expect(written).toContain("actions = ['p1 cbr 6 # open']");
  });

  test("writes each action through formatPhhAction", () => {
    expect(base.actions.map(formatPhhAction)).toEqual([
      "d dh p1 AcAd",
      "d dh p2 KcKd",
      "p1 cbr 6",
      "p2 cc",
    ]);
  });

  test("writes several histories as numbered tables", () => {
    expect(formatPhhs([base, history(stud)])).toBe(
      `[1]\n${noLimit}\n\n[2]\n${stud}`
    );
  });
});
