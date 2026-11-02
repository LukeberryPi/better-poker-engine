import { describe, expect, test } from "bun:test";

import type { Action, DealerAction, PlayerAction } from "../src/hand.ts";
import { actionSchema, playerActionSchema } from "../src/schemas.ts";
import { randomWalk } from "./random-hands.ts";

const playerActions: readonly PlayerAction[] = [
  { type: "fold" },
  { type: "fold", player: "p1" },
  { type: "checkOrCall" },
  { type: "postBringIn" },
  { type: "betOrRaiseTo", amount: 10 },
  { type: "draw", discard: ["As", "Td"] },
  { type: "draw", discard: [] },
  { type: "selectRunoutCount", count: 2 },
  { type: "selectRunoutCount", count: null },
  { type: "show" },
  { type: "show", cards: ["??", "K?"] },
  { type: "muck" },
  { type: "timeout", player: "p2" },
];

const dealerActions: readonly DealerAction[] = [
  { type: "postAnte" },
  { type: "collectBets" },
  { type: "postBlind", player: "p1" },
  { type: "burnCard" },
  { type: "burnCard", card: "2c" },
  { type: "dealHole", cards: ["As", "Ks"] },
  { type: "dealBoard", cards: ["As", "Kd", "2c"] },
  { type: "killHand", player: "p1" },
  { type: "pushChips" },
  { type: "pullChips" },
];

const garbage = [
  { type: "xyz" },
  null,
  undefined,
  42,
  "fold",
  [],
  { type: "betOrRaiseTo", amount: "10" },
  { type: "betOrRaiseTo" },
  { type: "draw", discard: ["Zz"] },
  { type: "draw", discard: ["10s"] },
  { type: "show", cards: "As" },
  { type: "fold", player: 1 },
];

describe("playerActionSchema", () => {
  test("parses every player action into the same action", () => {
    for (const action of playerActions) {
      expect(playerActionSchema.safeParse(action)).toEqual({
        success: true,
        data: action,
      });
    }
  });

  test("refuses every dealer step and anything that is not an action", () => {
    const accepted = [...dealerActions, ...garbage].filter(
      (input) => playerActionSchema.safeParse(input).success
    );
    expect(accepted).toEqual([]);
  });
});

describe("actionSchema", () => {
  test("parses every action into the same action", () => {
    const actions: readonly Action[] = [...playerActions, ...dealerActions];
    for (const action of actions) {
      expect(actionSchema.safeParse(action)).toEqual({
        success: true,
        data: action,
      });
    }
  });

  test("refuses anything that is not an action", () => {
    const accepted = garbage.filter(
      (input) => actionSchema.safeParse(input).success
    );
    expect(accepted).toEqual([]);
  });

  test("parses every action random hands try, accepted or refused", () => {
    const actions = Array.from({ length: 60 }, (_, seed) =>
      randomWalk(seed).steps.map((step) => step.action)
    ).flat();
    expect(
      actions.map((action) => actionSchema.safeParse(action).data)
    ).toEqual(actions);
  });
});
