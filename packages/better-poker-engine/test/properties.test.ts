import { describe, expect, test } from "bun:test";

import packageJson from "../package.json" with { type: "json" };
import type { Stack } from "../src/chips.ts";
import {
  act,
  replayHand,
  summarizeHand,
  type Action,
  type Transition,
} from "../src/hand.ts";
import { randomWalk, type Walk } from "./random-hands.ts";

const walks = Array.from({ length: 150 }, (_, seed) => randomWalk(seed));

function chips(stack: Stack): number {
  if (stack === "unbounded") throw new Error("Random hands use bounded stacks");
  return stack;
}

function total(values: readonly Stack[]): number {
  return values.reduce<number>((sum, value) => sum + chips(value), 0);
}

function transitions(walk: Walk): Transition[] {
  return [
    walk.start,
    ...walk.steps.flatMap((step) =>
      step.result.ok ? [step.result.value] : []
    ),
  ];
}

function acceptedActions(walk: Walk): Action[] {
  return walk.steps.flatMap((step) => (step.result.ok ? [step.action] : []));
}

describe("random hands", () => {
  test("cover every variant, refusals included", () => {
    const variants = new Set(walks.map((walk) => walk.setup.game.variant));
    expect(variants.size).toBe(11);
    expect(
      walks.some((walk) => walk.steps.some((step) => !step.result.ok))
    ).toBe(true);
  });

  test("keep every chip in a stack, a bet or a pot after every event", () => {
    const leaks = walks.flatMap((walk) => {
      const chipsInPlay = total(walk.setup.stacks);
      return transitions(walk).flatMap(({ events }) =>
        events.flatMap(({ seq, after }) => {
          const counted =
            total(after.stacks) +
            total(after.bets) +
            total(after.pots.map((pot) => pot.amount));
          return counted === chipsInPlay
            ? []
            : [{ seed: walk.seed, seq, counted, chipsInPlay }];
        })
      );
    });
    expect(leaks).toEqual([]);
  });

  test("never change the hand they act on, accepted or refused", () => {
    const changed = walks.flatMap((walk) =>
      walk.steps.flatMap((step, index) =>
        JSON.stringify(step.before) === step.beforeJson
          ? []
          : [{ seed: walk.seed, index }]
      )
    );
    expect(changed).toEqual([]);
  });

  test("act the same on a hand that went through JSON", () => {
    const differing = walks.flatMap((walk) =>
      walk.steps.flatMap((step, index) => {
        if (index % 5 !== 0) return [];
        const result = act(JSON.parse(step.beforeJson), step.action);
        return JSON.stringify(result) === JSON.stringify(step.result)
          ? []
          : [{ seed: walk.seed, index }];
      })
    );
    expect(differing).toEqual([]);
  });

  test("accept every option their decision offers", () => {
    const refused = walks.flatMap((walk) =>
      walk.steps.flatMap(({ stray, result, spectated, action }) =>
        stray || result.ok
          ? []
          : [{ seed: walk.seed, decision: spectated.decision, action }]
      )
    );
    expect(refused).toEqual([]);
  });

  test("record one event per transition, the action's first", () => {
    for (const walk of walks) {
      for (const [index, step] of walk.steps.entries()) {
        if (!step.result.ok) continue;
        const { events } = step.result.value;
        const [first, ...automated] = events;
        expect(first?.cause).toEqual({ kind: "action", action: step.action });
        expect(automated.map((event) => event.cause.kind)).toEqual(
          automated.map(() => "automation")
        );
        const { version } = step.spectated;
        expect(events.map((event) => event.seq)).toEqual(
          events.map((_, offset) => version + offset + 1)
        );
        const next = walk.steps[index + 1]?.spectated ?? walk.spectated;
        expect(next.version).toBe(version + events.length);
        expect(events.at(-1)?.after.waitingFor).toBe(next.decision.kind);
      }
    }
  });

  test("replay their actions into the same hand", () => {
    const differing = walks.flatMap((walk) => {
      const replayed = replayHand(walk.setup, acceptedActions(walk));
      return replayed.ok &&
        JSON.stringify(replayed.value.hand) === JSON.stringify(walk.hand)
        ? []
        : [walk.seed];
    });
    expect(differing).toEqual([]);
  });

  test("summarize once complete, nets adding up to minus rake and unclaimed chips", () => {
    for (const walk of walks) {
      expect(walk.steps.map((step) => summarizeHand(step.before))).toEqual(
        walk.steps.map(() => null)
      );
      const record = summarizeHand(walk.hand);
      if (record === null) throw new Error(`Seed ${walk.seed} is not complete`);
      const nets = record.players.map((player) => player.net ?? NaN);
      const kept = record.rake + record.unclaimed;
      expect(nets.reduce((sum, net) => sum + net, kept)).toBe(0);
      expect(record.players.map((player) => player.endingStack)).toEqual(
        walk.spectated.players.map((player) => player.stack)
      );
      expect(record.actions).toBe(acceptedActions(walk).length);
    }
  });

  test("carry the package version in their records", () => {
    const [walk] = walks;
    if (walk === undefined) throw new Error("No random hands");
    expect(summarizeHand(walk.hand)?.engineVersion).toBe(packageJson.version);
  });
});
