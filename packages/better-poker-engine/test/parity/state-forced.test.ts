import { expect } from "bun:test";

import { doctest } from "../../../../parity/harness.ts";
import { automation, type Hand, type PlayerId } from "../../src/hand.ts";
import { holdem, type Antes } from "../../src/rules.ts";
import { drive, pending, start, steps, type Driver } from "../driver.ts";

function noLimit(antes: Antes, players: number): Hand {
  const game = holdem.noLimit({ antes, blinds: [1, 2], minBet: 2 });
  return start(
    game,
    Array.from({ length: players }, () => 200),
    automation.none
  );
}

const bigBlindAnte = { kind: "byPosition", amounts: [0, 2] } as const;

doctest("pokerkit.state.State.ante_poster_indices", (example) => {
  let hand: Hand;
  let anteHolders: PlayerId[];
  example(1, () => {});
  example(2, () => {
    hand = noLimit(bigBlindAnte, 2);
  });
  example(3, () => {
    anteHolders = pending(hand, "antePosting");
  });
  example(4, () => expect(anteHolders).toEqual(["p1"]));
  example(5, () => {
    hand = noLimit({ kind: "everyone", amount: 2 }, 2);
  });
  example(6, () => {
    expect(pending(hand, "antePosting")).toEqual(["p1", "p2"]);
  });
  example(7, () => {
    hand = noLimit({ kind: "none" }, 2);
  });
  example(8, () => expect(pending(hand, "antePosting")).toEqual([]));
});

doctest("pokerkit.state.State.can_post_ante", (example) => {
  let table: Driver;
  example(1, () => {});
  example(2, () => {
    table = drive(noLimit(bigBlindAnte, 2));
  });
  example(3, () => expect(table.can({ type: "postAnte" })).toBe(true));
  example(4, () => {
    expect(table.can({ type: "postAnte", player: "p1" })).toBe(true);
  });
  example(5, () => {
    expect(table.can({ type: "postAnte", player: "p2" })).toBe(false);
  });
  example(6, () => {
    table = drive(noLimit({ kind: "none" }, 2));
  });
  example(7, () => expect(table.can({ type: "postAnte" })).toBe(false));
  example(8, () => {
    expect(table.can({ type: "postAnte", player: "p1" })).toBe(false);
  });
  example(9, () => {
    expect(table.can({ type: "postAnte", player: "p2" })).toBe(false);
  });
});

doctest("pokerkit.state.State.can_collect_bets", (example) => {
  let table: Driver;
  example(1, () => {});
  example(2, () => {
    table = drive(noLimit(bigBlindAnte, 2));
  });
  example(3, () => expect(table.can({ type: "collectBets" })).toBe(false));
  steps(example, () => table, [
    [4, { type: "postAnte" }, { type: "antePosted", player: "p1", amount: 2 }],
  ]);
  example(5, () => expect(table.can({ type: "collectBets" })).toBe(true));
});

doctest("pokerkit.state.State.blind_or_straddle_poster_indices", (example) => {
  let table: Driver;
  let blindHolders: PlayerId[];
  example(1, () => {});
  example(2, () => {
    table = drive(noLimit(bigBlindAnte, 4));
  });
  example(3, () => {
    blindHolders = pending(table.hand, "blindPosting");
  });
  example(4, () => expect(blindHolders).toEqual([]));
  steps(example, () => table, [
    [
      5,
      { type: "postAnte", player: "p2" },
      { type: "antePosted", player: "p2", amount: 2 },
    ],
    [
      6,
      { type: "collectBets" },
      { type: "betsCollected", collected: 2, returned: [] },
    ],
  ]);
  example(7, () => {
    expect(pending(table.hand, "blindPosting")).toEqual(["p1", "p2"]);
  });
});

doctest("pokerkit.state.State.can_post_blind_or_straddle", (example) => {
  let table: Driver;
  const canPost = (player?: PlayerId) =>
    table.can(
      player === undefined
        ? { type: "postBlind" }
        : { type: "postBlind", player }
    );
  example(1, () => {});
  example(2, () => {
    table = drive(noLimit(bigBlindAnte, 4));
  });
  example(3, () => expect(canPost()).toBe(false));
  steps(example, () => table, [
    [
      4,
      { type: "postAnte", player: "p2" },
      { type: "antePosted", player: "p2", amount: 2 },
    ],
    [
      5,
      { type: "collectBets" },
      { type: "betsCollected", collected: 2, returned: [] },
    ],
  ]);
  example(6, () => expect(canPost()).toBe(true));
  example(7, () => expect(canPost("p1")).toBe(true));
  example(8, () => expect(canPost("p2")).toBe(true));
  example(9, () => expect(canPost("p3")).toBe(false));
  example(10, () => expect(canPost("p4")).toBe(false));
});
