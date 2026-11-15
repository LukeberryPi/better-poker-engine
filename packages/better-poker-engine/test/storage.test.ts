import { describe, expect, test } from "bun:test";
import { inspect } from "node:util";

import { decks, shuffle } from "../src/cards.ts";
import { act, automation, type Hand } from "../src/hand.ts";
import { insecureSeededRandom } from "../src/random.ts";
import { holdem, kuhn } from "../src/rules.ts";
import { actAtTable, createTable, type Table } from "../src/table.ts";
import { parseHand, serializeHand } from "../src/storage.ts";
import { auditor, start } from "./driver.ts";
import { randomWalk } from "./random-hands.ts";
import { sameTransition } from "./support.ts";

const game = holdem.noLimit({ blinds: [1, 2], minBet: 2 });

function threeHanded(): Hand {
  const deck = shuffle(decks.standard, insecureSeededRandom(7));
  return start(game, [200, 200, 200], automation.all, deck);
}

type Stored = {
  setup: {
    stacks: number[];
    deck: string[];
    game: { rules?: object; boards: number };
  };
  events: { body: { type: string; player?: string; cards?: object[] } }[];
};

function stored(hand: Hand): Stored {
  return JSON.parse(serializeHand(hand));
}

function tampered(hand: Hand, edit: (data: Stored) => void): string {
  const data = stored(hand);
  edit(data);
  return JSON.stringify(data);
}

describe("a raw hand or table", () => {
  const seated = (): Table => {
    const created = createTable({ game, seats: 2 });
    if (!created.ok) throw new Error(JSON.stringify(created.error));
    let table = created.value;
    for (const command of [
      { type: "join", player: "ann", seat: 0, stack: 200 },
      { type: "join", player: "bo", seat: 1, stack: 200 },
      {
        type: "startHand",
        deck: shuffle(decks.standard, insecureSeededRandom(3)),
      },
    ] as const) {
      const next = actAtTable(table, command);
      if (!next.ok) throw new Error(JSON.stringify(next.error));
      table = next.value.table;
    }
    return table;
  };

  test("refuses JSON, so a log line or a response body can't carry the deck", () => {
    expect(() => JSON.stringify(threeHanded())).toThrow(/serializeHand/u);
    expect(() => JSON.stringify({ table: seated() })).toThrow(
      /serializeTable/u
    );
  });

  test("shows Node's inspector no card", () => {
    expect(inspect(threeHanded())).toBe("Hand [sealed]");
    expect(inspect(seated())).toBe("Table [sealed]");
  });
});

describe("serializeHand and parseHand", () => {
  const walks = Array.from({ length: 80 }, (_, seed) => randomWalk(seed));

  test("give back a hand that stores and plays the same, at every step", () => {
    const bodies = new Set<string>();
    for (const walk of walks) {
      for (const step of walk.steps.filter((_, index) => index % 4 === 0)) {
        const text = serializeHand(step.before);
        const parsed = parseHand(text);
        if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
        expect(serializeHand(parsed.value)).toBe(text);
        expect(
          sameTransition(act(parsed.value, step.action), step.result)
        ).toBe(true);
      }
      const parsed = parseHand(serializeHand(walk.hand));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
      expect(auditor(parsed.value)).toEqual(auditor(walk.hand));
      for (const event of stored(walk.hand).events) {
        bodies.add(event.body.type);
      }
    }
    expect(bodies.size).toBe(18);
  });

  test("refuse a stack edited behind the hand's back", () => {
    const text = tampered(threeHanded(), (data) => {
      data.setup.stacks[2] = 1_000_000;
    });
    expect(parseHand(text)).toEqual({
      ok: false,
      error: { code: "mismatch", seq: 1 },
    });
  });

  test("refuse a hole card that was never dealt", () => {
    const hand = threeHanded();
    const text = tampered(hand, (data) => {
      const dealt = data.events.find(
        ({ body }) => body.type === "holeDealt" && body.player === "p3"
      );
      if (dealt?.body.cards === undefined) throw new Error("p3 got no cards");
      dealt.body.cards = dealt.body.cards.map(() => ({
        card: "As",
        face: "down",
      }));
    });
    const result = parseHand(text);
    expect(result.ok ? null : result.error.code).toBe("mismatch");
  });

  test("refuse a deck holding a card twice", () => {
    const text = tampered(threeHanded(), (data) => {
      data.setup.deck[1] = data.setup.deck[0] ?? "";
    });
    expect(parseHand(text)).toMatchObject({
      ok: false,
      error: { code: "setup", error: { code: "duplicate_card" } },
    });
  });

  test("refuse an action the replay rejects", () => {
    const called = act(threeHanded(), { type: "checkOrCall" });
    if (!called.ok) throw new Error(called.error.code);
    const text = serializeHand(called.value.hand).replace(
      '"action":{"type":"checkOrCall"}',
      '"action":{"type":"betOrRaiseTo","amount":1}'
    );
    expect(parseHand(text)).toMatchObject({
      ok: false,
      error: { code: "rejected", violation: { code: "below_minimum" } },
    });
  });

  test("name the first field that does not parse", () => {
    const text = tampered(threeHanded(), (data) => {
      delete data.setup.game.rules;
    });
    expect(parseHand(text)).toMatchObject({
      ok: false,
      error: { code: "invalid_format", path: "setup.game.rules" },
    });
  });

  test("return an error for a setup the engine cannot play", () => {
    const kuhnHand = start(kuhn.fixedLimit(), [2, 2], automation.all);
    const text = tampered(kuhnHand, (data) => {
      data.setup.game.boards = 2 ** 32;
      data.events = [];
    });
    expect(parseHand(text)).toMatchObject({
      ok: false,
      error: { code: "unplayable" },
    });
  });

  test("return an error for any text that is not a stored hand", () => {
    const inputs = ["", "not json", "null", "{}", "[]", "42", '{"game":null}'];
    expect(inputs.map((input) => parseHand(input).ok)).toEqual(
      inputs.map(() => false)
    );
    expect(parseHand("not json")).toEqual({
      ok: false,
      error: { code: "invalid_json" },
    });
  });
});
