import { expect } from "bun:test";

import { doctest } from "../../../../parity/harness.ts";
import { automation } from "../../src/hand.ts";
import { holdem } from "../../src/rules.ts";
import { auditor, drive, start, type Driver } from "../driver.ts";

const game = holdem.noLimit({
  antes: { kind: "byPosition", amounts: [0, 2] },
  blinds: [1, 2],
  minBet: 2,
});

doctest("pokerkit.state.State.street", (example) => {
  let table: Driver;
  const street = () => auditor(table.hand).street;
  example(1, () => {});
  example(2, () => {
    table = drive(start(game, [200, 200], automation.none));
  });
  example(3, () => expect(street()).toBeNull());
  example(4, () => {
    expect(table.act({ type: "postAnte", player: "p1" })).toEqual({
      type: "antePosted",
      player: "p1",
      amount: 2,
    });
  });
  example(5, () => {
    expect(table.act({ type: "collectBets" })).toEqual({
      type: "betsCollected",
      collected: 2,
      returned: [],
    });
  });
  example(6, () => {
    expect(table.act({ type: "postBlind", player: "p1" })).toEqual({
      type: "blindPosted",
      player: "p1",
      amount: 2,
    });
  });
  example(7, () => expect(street()).toBeNull());
  example(8, () => {
    expect(table.act({ type: "postBlind", player: "p2" })).toEqual({
      type: "blindPosted",
      player: "p2",
      amount: 1,
    });
  });
  example(9, () => expect(street()).toBe(0));
  example(10, () => {
    expect(game.rules.streets[street() ?? -1]).toEqual({
      burn: false,
      hole: ["down", "down"],
      board: 0,
      draw: false,
      opening: "position",
      minCompletionBetOrRaise: 2,
      maxBetsAndRaises: null,
    });
  });
  const dealt = [
    [11, "p1", "Ac"],
    [12, "p2", "Kc"],
    [13, "p1", "Ad"],
    [14, "p2", "Kd"],
  ] as const;
  for (const [index, player, card] of dealt) {
    example(index, () => {
      expect(table.act({ type: "dealHole", cards: [card] })).toEqual({
        type: "holeDealt",
        player,
        cards: [{ card, face: "down" }],
      });
    });
  }
  example(15, () => {
    expect(table.act({ type: "checkOrCall" })).toEqual({
      type: "called",
      player: "p2",
      amount: 1,
      allIn: false,
    });
  });
  example(16, () => {
    expect(table.act({ type: "checkOrCall" })).toEqual({
      type: "checked",
      player: "p1",
    });
  });
  example(17, () => expect(street()).toBe(0));
  example(18, () => {
    expect(table.act({ type: "collectBets" })).toEqual({
      type: "betsCollected",
      collected: 4,
      returned: [],
    });
  });
  example(19, () => expect(street()).toBe(1));
  const streets = [
    { from: 20, burn: "2c", board: ["Ah", "Kh", "As"], street: 1 },
    { from: 26, burn: "2d", board: ["Ks"], street: 2 },
    { from: 32, burn: "2h", board: ["2s"], street: 3 },
  ] as const;
  for (const { from, burn, board, street: index } of streets) {
    example(from, () => {
      expect(table.act({ type: "burnCard", card: burn })).toEqual({
        type: "cardBurned",
        card: burn,
      });
    });
    example(from + 1, () => {
      expect(table.act({ type: "dealBoard", cards: [...board] })).toEqual({
        type: "boardDealt",
        board: 0,
        cards: board,
      });
    });
    example(from + 2, () => {
      expect(table.act({ type: "checkOrCall" })).toEqual({
        type: "checked",
        player: "p1",
      });
    });
    example(from + 3, () => expect(street()).toBe(index));
    example(from + 4, () => {
      expect(table.act({ type: "checkOrCall" })).toEqual({
        type: "checked",
        player: "p2",
      });
    });
    example(from + 5, () => expect(street()).toBe(Math.min(index + 1, 3)));
  }
  example(38, () => {
    expect(table.act({ type: "timeout" })).toEqual({
      type: "shown",
      player: "p1",
      cards: ["Ac", "Ad"],
    });
  });
  example(39, () => expect(street()).toBe(3));
  example(40, () => {
    expect(table.act({ type: "timeout" })).toEqual({
      type: "mucked",
      player: "p2",
    });
  });
  example(41, () => expect(street()).toBeNull());
  example(42, () => {
    expect(table.act({ type: "pushChips" })).toEqual({
      type: "chipsPushed",
      pot: 0,
      board: null,
      handType: null,
      awards: [{ player: "p1", amount: 6 }],
      unclaimed: 0,
    });
  });
  example(43, () => expect(street()).toBeNull());
  example(44, () => {
    expect(table.act({ type: "pullChips" })).toEqual({
      type: "chipsPulled",
      player: "p1",
      amount: 6,
    });
  });
  example(45, () => expect(street()).toBeNull());
  example(46, () => {
    table = drive(
      start(
        game,
        [200, 200],
        automation.all.filter((step) => step !== "runoutCountSelection")
      )
    );
  });
  example(47, () => expect(street()).toBe(0));
  example(48, () => {
    expect(table.act({ type: "fold" })).toEqual({
      type: "folded",
      player: "p2",
      needless: false,
    });
  });
  example(49, () => expect(street()).toBeNull());
});
