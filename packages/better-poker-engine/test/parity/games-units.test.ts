import { expect } from "bun:test";

import { unitTest } from "../../../../parity/harness.ts";
import { decks } from "../../src/cards.ts";
import { automation, type Hand } from "../../src/hand.ts";
import { kuhn, omaha, rhodeIsland, royal, type Game } from "../../src/rules.ts";
import {
  accept,
  allBut,
  auditor,
  drive,
  inProgress,
  minimumRaise,
  moves,
  play,
  repeat,
  stacks,
  start,
  type Driver,
} from "../driver.ts";
import { cards } from "../support.ts";

const { board, burn, call, deal, raise, raiseTo } = moves;

function selectRunoutCount(count: number | null) {
  return accept({ type: "selectRunoutCount", count });
}

unitTest(
  "pokerkit.tests.test_games.PotLimitOmahaHoldemTestCase.test_double_board",
  () => {
    const game = omaha.potLimit({
      blinds: [1, 2],
      minBet: 2,
      anteTrimming: true,
      boards: 2,
      mode: "cashGame",
    });
    const newHand = () =>
      drive(
        start(
          game,
          repeat(200, 4),
          allBut(
            "cardBurning",
            "holeDealing",
            "boardDealing",
            "runoutCountSelection"
          )
        )
      );
    const holes = ["AcKc3c2c", "AdKd3d2d", "AhKh3h2h", "AsKs3s2s"].map(deal);
    const boardCards = (table: Driver) => auditor(table.hand).boards;

    let table = newHand();
    play(table, [
      ...holes,
      ...repeat(call, 4),
      ...[burn, board("QcJcTc"), board("QdJdTd"), ...repeat(call, 4)],
      ...[burn, board("9c"), board("9d"), ...repeat(call, 4)],
      ...[burn, board("8c"), board("8d"), ...repeat(call, 4)],
    ]);
    expect(inProgress(table.hand)).toBe(false);
    expect(stacks(table.hand)).toEqual([202, 202, 198, 198]);
    expect(boardCards(table)).toHaveLength(2);
    expect(boardCards(table)[0]).toEqual(cards("QcJcTc9c8c"));
    expect(boardCards(table)[1]).toEqual(cards("QdJdTd9d8d"));

    table = newHand();
    play(table, [
      ...holes,
      ...[raiseTo(7), raiseTo(24), raiseTo(81), raiseTo(200)],
      ...repeat(call, 3),
      ...repeat(selectRunoutCount(1), 4),
      ...[burn, board("QcJcTc"), board("QdJdTd")],
      ...[burn, board("9c"), board("9d")],
      ...[burn, board("8c"), board("8d")],
    ]);
    expect(inProgress(table.hand)).toBe(false);
    expect(stacks(table.hand)).toEqual([400, 400, 0, 0]);
    expect(boardCards(table)).toHaveLength(2);
    expect(boardCards(table)[0]).toEqual(cards("QcJcTc9c8c"));
    expect(boardCards(table)[1]).toEqual(cards("QdJdTd9d8d"));

    table = newHand();
    play(table, [
      ...holes,
      ...repeat(call, 4),
      ...[burn, board("QcJcTc"), board("QdJhTs")],
      ...[raiseTo(8), raiseTo(32), raiseTo(112), raiseTo(198)],
      ...repeat(call, 3),
      ...repeat(selectRunoutCount(null), 3),
      selectRunoutCount(2),
      ...[burn, board("7c"), board("7d")],
      ...[burn, board("6c"), board("6d")],
      ...[burn, board("5c"), board("7s")],
      ...[burn, board("4c"), board("6s")],
    ]);
    expect(inProgress(table.hand)).toBe(false);
    expect(stacks(table.hand)).toEqual([450, 50, 50, 250]);
    expect(boardCards(table)).toHaveLength(4);
    expect(boardCards(table)[0]).toEqual(cards("QcJcTc7c6c"));
    expect(boardCards(table)[1]).toEqual(cards("QcJcTc7d6d"));
    expect(boardCards(table)[2]).toEqual(cards("QdJhTs5c4c"));
    expect(boardCards(table)[3]).toEqual(cards("QdJhTs7s6s"));
  }
);

unitTest(
  "pokerkit.tests.test_games.NoLimitRoyalHoldemTestCase.test_create_state",
  () => {
    const game = royal.noLimit({
      blinds: [1, 2],
      minBet: 2,
      anteTrimming: true,
    });
    const table = drive(start(game, repeat(200, 3), automation.all));
    const deckCards = () => auditor(table.hand).dealer?.deck;

    expect(decks[game.rules.deck]).toHaveLength(20);
    expect(deckCards()).toHaveLength(14);
    play(table, repeat(call, 3));

    expect(deckCards()).toHaveLength(10);
    play(table, repeat(call, 3));

    expect(deckCards()).toHaveLength(8);
    play(table, repeat(call, 3));

    expect(deckCards()).toHaveLength(6);
    play(table, repeat(call, 3));

    expect(inProgress(table.hand)).toBe(false);
  }
);

unitTest(
  "pokerkit.tests.test_games.KuhnPokerTestCase.test_create_state",
  () => {
    const state0: Game = {
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
            maxBetsAndRaises: 1,
          },
        ],
        structure: "fixedLimit",
      },
      forcedBets: {
        antes: { kind: "everyone", amount: 1 },
        blinds: [],
        bringIn: null,
        anteTrimming: true,
      },
      rake: { kind: "none" },
      mode: "tournament",
      boards: 1,
    };
    const state1 = kuhn.fixedLimit();
    expect(start(state0, [2, 2], automation.none)).toEqual(
      start(state1, [2, 2], automation.none)
    );
  }
);

unitTest(
  "pokerkit.tests.test_games.RhodeIslandHoldemTestCase.test_create_state",
  () => {
    const startingStacks = (hand: Hand) =>
      auditor(hand).players.map((player) => player.startingStack);
    const postAnte = accept({ type: "postAnte" });
    const collectBets = accept({ type: "collectBets" });
    const showOrMuck = accept({ type: "timeout" });
    const ending = [
      ...[showOrMuck, showOrMuck],
      accept({ type: "killHand" }),
      accept({ type: "pushChips" }),
      accept({ type: "pullChips" }),
    ];

    let table = drive(
      start(rhodeIsland.fixedLimit(), [155, 155], automation.none)
    );
    expect(startingStacks(table.hand)).toEqual([155, 155]);
    play(table, [
      ...[postAnte, postAnte, collectBets],
      ...[deal("As"), deal("Kc"), call, raise, call, collectBets],
      ...[burn, board("Ac"), raise, call, collectBets],
      ...[burn, board("Qc"), raise, call, collectBets],
      ...ending,
    ]);
    expect(inProgress(table.hand)).toBe(false);
    expect(stacks(table.hand)).toEqual([100, 210]);

    table = drive(start(rhodeIsland.fixedLimit(), [155, 155], automation.none));
    expect(startingStacks(table.hand)).toEqual([155, 155]);
    play(table, [
      ...[postAnte, postAnte, collectBets],
      ...[deal("As"), deal("Kc"), call, raise, raise, raise],
    ]);
    expect(table.can(minimumRaise(table))).toBe(false);
    play(table, [call, collectBets, burn, board("Ac"), raise, raise, raise]);
    expect(table.can(minimumRaise(table))).toBe(false);
    play(table, [call, collectBets, burn, board("Qc"), raise, raise, raise]);
    expect(table.can(minimumRaise(table))).toBe(false);
    play(table, [call, collectBets, ...ending]);
    expect(inProgress(table.hand)).toBe(false);
    expect(stacks(table.hand)).toEqual([0, 310]);
  }
);
