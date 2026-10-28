import { expect } from "bun:test";

import { doctest } from "../../../../parity/harness.ts";
import { suitOf } from "../../src/cards.ts";
import { automation, startHand, type Hand } from "../../src/hand.ts";
import {
  draw,
  holdem,
  omaha,
  stud,
  type Game,
  type Street,
} from "../../src/rules.ts";
import {
  auditor,
  bets,
  drive,
  inProgress,
  repeat,
  spectator,
  stacks,
  start,
  totalPot,
  type Driver,
} from "../driver.ts";

const noLimit = holdem.noLimit({
  antes: { kind: "byPosition", amounts: [0, 2] },
  blinds: [1, 2],
  minBet: 2,
});

doctest("pokerkit.state.BettingStructure", (example) => {
  example(1, () => {
    const game = holdem.fixedLimit({ blinds: [1, 2], smallBet: 2, bigBet: 4 });
    expect(game.rules.structure).toBe("fixedLimit");
  });
  example(2, () => expect(noLimit.rules.structure).toBe("noLimit"));
});

doctest("pokerkit.state.Opening", (example) => {
  example(1, () => expect(noLimit.rules.streets[0].opening).toBe("position"));
  example(2, () => {
    const razz = stud.razz({ bringIn: 1, smallBet: 2, bigBet: 4 });
    expect(razz.rules.streets[1]?.opening).toBe("lowHand");
  });
});

doctest("pokerkit.state.Street", (example) => {
  let street: Street;
  example(1, () => {
    street = {
      burn: false,
      hole: ["down", "down"],
      board: 0,
      draw: false,
      opening: "position",
      minCompletionBetOrRaise: 2,
      maxBetsAndRaises: null,
    };
    const rules = { ...noLimit.rules, streets: [street] as const };
    const game = { ...noLimit, rules };
    expect(
      startHand({ game, stacks: [200, 200], deck: [], automate: [] }).ok
    ).toBe(true);
  });
  example(2, () => expect(street.burn).toBe(false));
  example(3, () => expect(street.hole).toEqual(["down", "down"]));
});

doctest("pokerkit.state.Automation", (example) => {
  example(1, () => expect(automation.all).toContain("antePosting"));
  example(2, () => expect(automation.all).toContain("cardBurning"));
});

doctest("pokerkit.state.Mode", (example) => {
  example(1, () => expect(noLimit.mode).toBe("tournament"));
  example(2, () => {
    const cashGame = holdem.noLimit({
      blinds: [1, 2],
      minBet: 2,
      mode: "cashGame",
    });
    expect(cashGame.mode).toBe("cashGame");
  });
});

doctest("pokerkit.state.BetCollection.total_bets", (example) => {
  let collected: number;
  example(1, () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [1, 2, 3] },
      blinds: [],
      minBet: 2,
    });
    const body = drive(start(game, [100, 100, 100], ["antePosting"])).act({
      type: "collectBets",
    });
    if (body.type !== "betsCollected") throw new Error(body.type);
    collected = body.collected;
  });
  example(2, () => expect(collected).toBe(6));
});

function kuhn(maxBetsAndRaises: number | null): Game {
  return {
    variant: "custom",
    rules: {
      deck: "kuhn",
      handTypes: ["kuhn"],
      streets: [
        {
          burn: false,
          hole: ["down"],
          board: 0,
          draw: false,
          opening: "position",
          minCompletionBetOrRaise: 1,
          maxBetsAndRaises,
        },
      ],
      structure: "fixedLimit",
    },
    forcedBets: {
      antes: { kind: "everyone", amount: 1 },
      blinds: [0, 0],
      bringIn: null,
      anteTrimming: true,
    },
    rake: { kind: "none" },
    mode: "tournament",
    boards: 1,
  };
}

doctest("pokerkit.state.State", (example) => {
  let table: Driver;
  example(1, () => {});
  example(2, () => {
    table = drive(
      start(
        kuhn(1),
        [2, 2],
        automation.all.filter((step) => step !== "runoutCountSelection")
      )
    );
  });
  example(3, () => expect(inProgress(table.hand)).toBe(true));
  example(4, () => expect(stacks(table.hand)).toEqual([1, 1]));
  example(5, () => expect(bets(table.hand)).toEqual([0, 0]));
  example(6, () => {
    const holes = auditor(table.hand).players.map((player) =>
      player.holeCards.map(({ card }) => suitOf(card))
    );
    expect(holes).toEqual([["s"], ["s"]]);
  });
  example(7, () => {
    expect(table.act({ type: "checkOrCall" })).toEqual({
      type: "checked",
      player: "p1",
    });
  });
  example(8, () => expect(stacks(table.hand)).toEqual([1, 1]));
  example(9, () => expect(bets(table.hand)).toEqual([0, 0]));
  example(10, () => {
    expect(table.act({ type: "betOrRaiseTo", amount: 1 })).toEqual({
      type: "betOrRaised",
      player: "p2",
      kind: "bet",
      to: 1,
      allIn: true,
    });
  });
  example(11, () => expect(stacks(table.hand)).toEqual([1, 0]));
  example(12, () => expect(bets(table.hand)).toEqual([0, 1]));
  example(13, () => {
    expect(table.act({ type: "fold" })).toEqual({
      type: "folded",
      player: "p1",
      needless: false,
    });
  });
  example(14, () => expect(stacks(table.hand)).toEqual([1, 3]));
  example(15, () => expect(bets(table.hand)).toEqual([0, 0]));
  example(16, () => expect(totalPot(table.hand)).toBe(0));
  example(17, () => expect(inProgress(table.hand)).toBe(false));
  example(18, () => {
    table = drive(start(kuhn(null), [2, 2], automation.none));
  });
  example(19, () => expect(inProgress(table.hand)).toBe(true));
  example(20, () => {
    expect(table.act({ type: "postAnte", player: "p1" })).toEqual({
      type: "antePosted",
      player: "p1",
      amount: 1,
    });
  });
  example(21, () => {
    expect(table.act({ type: "postAnte", player: "p2" })).toEqual({
      type: "antePosted",
      player: "p2",
      amount: 1,
    });
  });
  example(22, () => {
    expect(table.act({ type: "collectBets" })).toEqual({
      type: "betsCollected",
      collected: 2,
      returned: [],
    });
  });
  example(23, () => {
    expect(table.act({ type: "dealHole", cards: ["Js"] })).toEqual({
      type: "holeDealt",
      player: "p1",
      cards: [{ card: "Js", face: "down" }],
    });
  });
  example(24, () => {
    const body = table.act({ type: "dealHole" });
    if (body.type !== "holeDealt") throw new Error(body.type);
    expect(body.player).toBe("p2");
    expect(body.cards.map(({ card, face }) => [suitOf(card), face])).toEqual([
      ["s", "down"],
    ]);
  });
  example(25, () => {
    expect(table.act({ type: "checkOrCall" })).toEqual({
      type: "checked",
      player: "p1",
    });
  });
  example(26, () => {
    expect(table.act({ type: "betOrRaiseTo", amount: 1 })).toEqual({
      type: "betOrRaised",
      player: "p2",
      kind: "bet",
      to: 1,
      allIn: true,
    });
  });
  example(27, () => {
    expect(table.act({ type: "fold" })).toEqual({
      type: "folded",
      player: "p1",
      needless: false,
    });
  });
  example(28, () => {
    expect(table.act({ type: "collectBets" })).toEqual({
      type: "betsCollected",
      collected: 0,
      returned: [],
    });
  });
  example(29, () => {
    expect(table.act({ type: "pushChips" })).toEqual({
      type: "chipsPushed",
      pot: 0,
      board: null,
      handType: null,
      awards: [{ player: "p2", amount: 2 }],
      unclaimed: 0,
    });
  });
  example(30, () => {
    expect(table.act({ type: "pullChips", player: "p2" })).toEqual({
      type: "chipsPulled",
      player: "p2",
      amount: 3,
    });
  });
  example(31, () => expect(inProgress(table.hand)).toBe(false));
});

const omahaHiLo = omaha.fixedLimitHiLo({
  antes: { kind: "everyone", amount: 1 },
  blinds: [1, 2],
  smallBet: 2,
  bigBet: 4,
  anteTrimming: true,
});

/** Hand types count from the hands each player view lists per board. */
function handTypeCount(hand: Hand): number {
  return spectator(hand).players[0]?.hands[0]?.length ?? 0;
}

doctest("pokerkit.state.State.hand_type_count", (example) => {
  let hand: Hand;
  example(1, () => {});
  example(2, () => {
    hand = start(noLimit, [200, 200], automation.none);
  });
  example(3, () => expect(handTypeCount(hand)).toBe(1));
  example(4, () => {
    hand = start(omahaHiLo, [100, 100, 100], automation.none);
  });
  example(5, () => expect(handTypeCount(hand)).toBe(2));
});

doctest("pokerkit.state.State.hand_type_indices", (example) => {
  let hand: Hand;
  const indices = () => [
    ...(spectator(hand).players[0]?.hands[0]?.keys() ?? []),
  ];
  example(1, () => {});
  example(2, () => {
    hand = start(noLimit, [200, 200], automation.none);
  });
  example(3, () => expect(indices()).toEqual([0]));
  example(4, () => {
    hand = start(omahaHiLo, [100, 100, 100], automation.none);
  });
  example(5, () => expect(indices()).toEqual([0, 1]));
});

doctest("pokerkit.state.State.draw_statuses", (example) => {
  let game: Game;
  let statuses: boolean[];
  example(1, () => {});
  example(2, () => {
    game = noLimit;
  });
  example(3, () => {
    statuses = game.rules.streets.map((street) => street.draw);
  });
  example(4, () => expect(statuses).toEqual([false, false, false, false]));
  example(5, () => {
    game = draw.deuceToSevenSingle({
      antes: { kind: "everyone", amount: 1 },
      blinds: [1, 2],
      minBet: 2,
      anteTrimming: true,
    });
  });
  example(6, () => {
    expect(game.rules.streets.map((street) => street.draw)).toEqual([
      false,
      true,
    ]);
  });
});

doctest("pokerkit.state.State.player_indices", (example) => {
  let hand: Hand;
  const positions = () =>
    spectator(hand).players.map((player) => player.position);
  example(1, () => {});
  example(2, () => {
    hand = start(noLimit, [200, 200], automation.none);
  });
  example(3, () => expect(positions()).toEqual([0, 1]));
  example(4, () => {
    const game = holdem.noLimit({
      antes: { kind: "everyone", amount: 1 },
      blinds: [1, 2],
      minBet: 2,
      anteTrimming: true,
    });
    hand = start(game, repeat(200, 9), automation.none);
  });
  example(5, () => expect(positions()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]));
});
