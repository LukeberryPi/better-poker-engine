import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import type { EventBody } from "../src/events.ts";
import {
  parsePhhs,
  replayHistory,
  type HistoryReplay,
  type Phh,
} from "../src/phh.ts";
import { err } from "../src/result.ts";
import { boardDealt, burned, checked, inProgress, stacks } from "./driver.ts";
import { parsed, replayed } from "./phh-support.ts";

const fixtures = new URL("fixtures/phh/", import.meta.url);

function fixture(path: string): string {
  return readFileSync(new URL(path, fixtures), "utf8");
}

function bodies(replay: HistoryReplay): (string | null | EventBody)[][] {
  return replay.steps.map((step) => [
    step.action,
    ...step.events.map((event) => event.body),
  ]);
}

function noLimit(players: number, actions: readonly string[]): Phh {
  const zeros = Array.from({ length: players }, () => 0);
  const blinds = zeros.map((zero, position) =>
    position < 2 ? position + 1 : zero
  );
  return parsed(
    [
      "variant = 'NT'",
      `antes = [${zeros.join(", ")}]`,
      `blinds_or_straddles = [${blinds.join(", ")}]`,
      "min_bet = 2",
      `starting_stacks = [${zeros.map(() => 200).join(", ")}]`,
      `actions = [${actions.map((action) => `'${action}'`).join(", ")}]`,
    ].join("\n")
  );
}

const headsUpFlop = [
  "d dh p1 AcAd",
  "d dh p2 KcKd",
  "p2 cc",
  "p1 cc",
  "d db 2c3c4c",
];

describe("replayHistory", () => {
  test("plays pokerkit's WSOP histories to the stacks they finish with", () => {
    const files = readdirSync(new URL("wsop/", fixtures));
    expect(files).toHaveLength(9);
    for (const file of files) {
      const history = parsed(fixture(`wsop/${file}`));
      const { final } = replayed(history);
      expect(inProgress(final)).toBe(false);
      expect(stacks(final)).toEqual(
        (history.finishingStacks ?? []).map(Number)
      );
    }
  });

  test("reads a negative blind as a live post bet", () => {
    const histories = parsePhhs(fixture("handhq-ps-25nlh-1-30.phhs"));
    if (!histories.ok) throw new Error(JSON.stringify(histories.error));
    const postBet = histories.value[8];
    if (postBet === undefined) throw new Error("No ninth history");
    const replay = replayed(postBet, { amountScale: 100 });
    expect(replay.steps[0]?.events.map((event) => event.body)).toEqual([
      { type: "blindPosted", player: "p1", amount: 10 },
      { type: "blindPosted", player: "p2", amount: 25 },
      { type: "blindPosted", player: "p3", amount: 25 },
    ]);
    expect(bodies(replay)[6]).toEqual(["p3 cc", checked("p3")]);
    expect(stacks(replay.final)).toEqual([5330, 770, 805, 775, 3020]);
  });

  test("burns '??' where the history deals without burning", () => {
    expect(bodies(replayed(noLimit(2, headsUpFlop))).slice(4)).toEqual([
      [
        "p1 cc",
        checked("p1"),
        { type: "betsCollected", collected: 4, returned: [] },
      ],
      ["d db 2c3c4c", burned("??"), boardDealt("2c3c4c")],
    ]);
  });

  test("makes each burn a step of its own unless cardBurning is automated", () => {
    const replay = replayed(noLimit(2, headsUpFlop), {
      automate: [
        "antePosting",
        "betCollection",
        "blindPosting",
        "runoutCountSelection",
        "handKilling",
        "chipsPushing",
        "chipsPulling",
      ],
    });
    expect(bodies(replay).slice(5)).toEqual([
      [null, burned("??")],
      ["d db 2c3c4c", boardDealt("2c3c4c")],
    ]);
  });

  test("deals '??' to a player the history deals nothing", () => {
    const replay = replayed(noLimit(2, ["d dh p1 AcAd", "p2 cc"]));
    expect(bodies(replay).slice(2)).toEqual([
      [
        null,
        {
          type: "holeDealt",
          player: "p2",
          cards: [{ card: "??", face: "down" }],
        },
      ],
      [
        null,
        {
          type: "holeDealt",
          player: "p2",
          cards: [{ card: "??", face: "down" }],
        },
      ],
      ["p2 cc", { type: "called", player: "p2", amount: 1, allIn: false }],
    ]);
  });

  test("folds or checks for players the history skips, as pokerkit does", () => {
    const replay = replayed(
      noLimit(3, [
        "d dh p1 ????",
        "d dh p2 ????",
        "d dh p3 ????",
        "p1 cc",
        "d db 2c3c4c",
      ])
    );
    expect(bodies(replay).slice(4)).toEqual([
      [null, { type: "folded", player: "p3", needless: false }],
      ["p1 cc", { type: "called", player: "p1", amount: 1, allIn: false }],
      [
        null,
        checked("p2"),
        { type: "betsCollected", collected: 4, returned: [] },
      ],
      ["d db 2c3c4c", burned("??"), boardDealt("2c3c4c")],
    ]);
  });

  test("shows nothing for players a finished history leaves at the showdown", () => {
    const river = [
      ...headsUpFlop,
      "p1 cc",
      "p2 cc",
      "d db 5d",
      "p1 cc",
      "p2 cc",
      "d db 9s",
      "p1 cc",
      "p2 cc",
    ];
    const filled = replayed(noLimit(2, river)).steps.filter(
      (step) => step.action === null
    );
    expect(filled.map((step) => step.events[0]?.body).slice(1)).toEqual([
      { type: "shown", player: "p1", cards: ["??", "??"] },
      { type: "shown", player: "p2", cards: ["??", "??"] },
    ]);
  });

  test("keeps a comment-only action as a step that changes nothing", () => {
    const replay = replayed(noLimit(2, ["d dh p1 AcAd", "# rail chatter"]));
    const [, dealt, comment] = replay.steps;
    expect(comment?.action).toBe("# rail chatter");
    expect(comment?.events).toEqual([]);
    expect(comment?.hand).toBe(dealt?.hand);
  });

  test("hands each action's commentary to the engine", () => {
    const replay = replayed(
      noLimit(2, ["d dh p1 AcAd", "d dh p2 KcKd", "p2 f # tilt"])
    );
    const fold = replay.steps.find((step) => step.action === "p2 f # tilt");
    expect(fold?.events[0]?.commentary).toBe("tilt");
  });
});

describe("replayHistory errors", () => {
  test("reports why the engine refused an action nothing fills in for", () => {
    expect(
      replayHistory(noLimit(2, ["d dh p1 AcAd", "d dh p2 KcKd", "p2 cbr 3"]))
    ).toEqual(
      err({
        code: "rejected",
        index: 2,
        action: "p2 cbr 3",
        violation: { code: "below_minimum", attempted: 3, minimum: 4 },
      })
    );
  });

  test("names the amount the scale cannot hold", () => {
    expect(
      replayHistory(noLimit(2, ["d dh p1 AcAd", "d dh p2 KcKd", "p2 cbr 6.5"]))
    ).toEqual(
      err({
        code: "not_integral",
        amount: "6.5",
        scale: 1,
        field: "actions[2]",
      })
    );
    const histories = parsePhhs(fixture("handhq-ps-25nlh-1-30.phhs"));
    if (!histories.ok) throw new Error(JSON.stringify(histories.error));
    const cents = histories.value[0];
    if (cents === undefined) throw new Error("No first history");
    expect(replayHistory(cents, { amountScale: 10 })).toEqual(
      err({
        code: "not_integral",
        amount: "0.25",
        scale: 10,
        field: "blinds_or_straddles[1]",
      })
    );
  });

  test("reports a setup the engine refuses", () => {
    const alone = parsed(
      [
        "variant = 'NT'",
        "antes = [0]",
        "blinds_or_straddles = [2]",
        "min_bet = 2",
        "starting_stacks = [200]",
        "actions = []",
      ].join("\n")
    );
    expect(replayHistory(alone)).toEqual(
      err({ code: "setup", error: { code: "player_count", players: 1 } })
    );
  });
});
