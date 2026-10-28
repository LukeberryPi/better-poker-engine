import { decks, shuffle, type Card } from "../src/cards.ts";
import {
  act,
  automation,
  startHand,
  type Action,
  type Automation,
  type DealerDecision,
  type Hand,
  type HandSetup,
  type Transition,
  type Violation,
} from "../src/hand.ts";
import { randomBelow, seededRandom, type RandomSource } from "../src/random.ts";
import type { Result } from "../src/result.ts";
import {
  draw,
  holdem,
  omaha,
  shortDeck,
  stud,
  type Antes,
  type Game,
  type Rake,
} from "../src/rules.ts";
import { viewHand, type HandView } from "../src/views.ts";

function pick<T>(items: readonly T[], random: RandomSource): T {
  const item = items[randomBelow(items.length, random)];
  if (item === undefined) throw new Error("Picked from an empty list");
  return item;
}

function between(min: number, max: number, random: RandomSource): number {
  return min + randomBelow(max - min + 1, random);
}

function chance(percent: number, random: RandomSource): boolean {
  return randomBelow(100, random) < percent;
}

function randomOptions(random: RandomSource) {
  const antes = pick<Antes>(
    [
      { kind: "none" },
      { kind: "everyone", amount: between(1, 2, random) },
      { kind: "button", amount: 2 },
      { kind: "bigBlind", amount: 2 },
    ],
    random
  );
  const rake = pick<Rake>(
    [
      { kind: "none" },
      {
        kind: "percentage",
        basisPoints: pick([500, 1000, 2500], random),
        cap: pick([null, 3], random),
        noFlopNoDrop: chance(50, random),
      },
    ],
    random
  );
  return {
    antes,
    rake,
    mode: pick(["tournament", "cashGame"] as const, random),
    anteTrimming: chance(50, random),
  };
}

const blinds = [1, 2];
const limits = { smallBet: 2, bigBet: 4 };

/** Every builder, with random antes, rake, mode, ante trimming and boards. */
const games: readonly ((random: RandomSource) => Game)[] = [
  (random) =>
    holdem.noLimit({
      ...randomOptions(random),
      blinds,
      minBet: 2,
      boards: between(1, 2, random),
    }),
  (random) =>
    holdem.fixedLimit({ ...randomOptions(random), blinds, ...limits }),
  (random) =>
    shortDeck.noLimit({ ...randomOptions(random), blinds, minBet: 2 }),
  (random) =>
    omaha.potLimit({
      ...randomOptions(random),
      blinds,
      minBet: 2,
      boards: between(1, 2, random),
    }),
  (random) =>
    omaha.fixedLimitHiLo({ ...randomOptions(random), blinds, ...limits }),
  (random) =>
    stud.fixedLimit({ ...randomOptions(random), bringIn: 1, ...limits }),
  (random) =>
    stud.fixedLimitHiLo({ ...randomOptions(random), bringIn: 1, ...limits }),
  (random) => stud.razz({ ...randomOptions(random), bringIn: 1, ...limits }),
  (random) =>
    draw.deuceToSevenSingle({ ...randomOptions(random), blinds, minBet: 2 }),
  (random) =>
    draw.deuceToSevenTriple({ ...randomOptions(random), blinds, ...limits }),
  (random) => draw.badugi({ ...randomOptions(random), blinds, ...limits }),
];

function randomAutomation(random: RandomSource): Automation {
  return pick(
    [
      automation.all,
      automation.dealer,
      automation.none,
      automation.all.filter(() => chance(50, random)),
    ],
    random
  );
}

/** Bounded stacks only, so chips add up; short ones force all-ins and side pots. */
export function randomSetup(random: RandomSource): HandSetup {
  const game = pick(games, random)(random);
  const players = between(2, 6, random);
  const deep = chance(50, random);
  return {
    game,
    stacks: Array.from({ length: players }, () =>
      deep ? between(20, 300, random) : between(1, 20, random)
    ),
    deck: shuffle(decks[game.rules.deck], random),
    automate: randomAutomation(random),
  };
}

function dealerAction(decision: DealerDecision): Action {
  switch (decision.step) {
    case "antePosting":
      return { type: "postAnte" };
    case "betCollection":
      return { type: "collectBets" };
    case "blindPosting":
      return { type: "postBlind" };
    case "cardBurning":
      return { type: "burnCard" };
    case "holeDealing":
      return { type: "dealHole" };
    case "boardDealing":
      return { type: "dealBoard" };
    case "handKilling":
      return { type: "killHand" };
    case "chipsPushing":
      return { type: "pushChips" };
    case "chipsPulling":
      return { type: "pullChips" };
  }
}

/** A legal-looking action for whoever the hand waits on; null once it is complete. */
function plausibleAction(
  hand: Hand,
  view: HandView,
  random: RandomSource
): Action | null {
  const { decision } = view;
  switch (decision.kind) {
    case "complete":
      return null;
    case "betting": {
      const options: Action[] = [];
      if (decision.fold !== null) options.push({ type: "fold" });
      if (decision.checkOrCall !== null) {
        options.push({ type: "checkOrCall" }, { type: "checkOrCall" });
      }
      if (decision.betOrRaiseTo !== null) {
        const { min, max } = decision.betOrRaiseTo;
        const top = max === "unbounded" ? 3 * min : max;
        options.push({
          type: "betOrRaiseTo",
          amount: between(min, top, random),
        });
      }
      if (decision.bringIn !== null) options.push({ type: "postBringIn" });
      return pick(options, random);
    }
    case "drawing": {
      const drawer = viewHand(hand, {
        kind: "player",
        player: decision.player,
      });
      const held =
        drawer.players.find((player) => player.player === decision.player)
          ?.holeCards ?? [];
      const discard = held
        .filter(() => chance(40, random))
        .slice(0, decision.maxDiscards)
        .map((hole) => hole.card);
      return { type: "draw", discard };
    }
    case "runoutSelection":
      return {
        type: "selectRunoutCount",
        player: pick(decision.players, random),
        count: pick([null, 1, 2, 3], random),
      };
    case "showdown":
      return pick<Action>(
        [{ type: "show" }, { type: "muck" }, { type: "timeout" }],
        random
      );
    case "dealer":
      return dealerAction(decision);
  }
}

/** Anything at all, mostly out of turn or out of range, to exercise refusals. */
function strayAction(view: HandView, random: RandomSource): Action {
  const player = pick(
    [...view.players.map((seat) => seat.player), "p0"],
    random
  );
  const card = pick<Card>(decks.standard, random);
  return pick<Action>(
    [
      { type: "fold", player },
      { type: "checkOrCall", player },
      { type: "postBringIn" },
      { type: "betOrRaiseTo", amount: between(-1, 400, random) },
      { type: "betOrRaiseTo", amount: 2.5 },
      { type: "draw", discard: [card] },
      { type: "selectRunoutCount", count: between(0, 4, random) },
      { type: "show", player },
      { type: "muck", player },
      { type: "timeout", player },
      { type: "postAnte", player },
      { type: "collectBets" },
      { type: "postBlind" },
      { type: "burnCard" },
      { type: "dealHole", player },
      { type: "dealBoard" },
      { type: "killHand", player },
      { type: "pushChips" },
      { type: "pullChips", player },
    ],
    random
  );
}

export type Step = {
  readonly before: Hand;
  /** `before` serialized before `act` ran, to prove `act` left it alone. */
  readonly beforeJson: string;
  readonly spectated: HandView;
  readonly action: Action;
  /** Not one of the options the decision offered. */
  readonly stray: boolean;
  readonly result: Result<Transition, Violation>;
};

export type Walk = {
  readonly seed: number;
  readonly setup: HandSetup;
  readonly start: Transition;
  readonly steps: readonly Step[];
  /** The hand after the last accepted action. */
  readonly hand: Hand;
  readonly spectated: HandView;
};

const maxSteps = 2000;

/** A random hand played to completion, refused attempts included. */
export function randomWalk(seed: number): Walk {
  const random = seededRandom(seed);
  const setup = randomSetup(random);
  const started = startHand(setup);
  if (!started.ok) {
    throw new Error(`Seed ${seed}: ${JSON.stringify(started.error)}`);
  }
  const steps: Step[] = [];
  let hand = started.value.hand;
  while (steps.length < maxSteps) {
    const spectated = viewHand(hand, { kind: "spectator" });
    const plausible = plausibleAction(hand, spectated, random);
    if (plausible === null) {
      return { seed, setup, start: started.value, steps, hand, spectated };
    }
    const stray = chance(15, random);
    const action = stray ? strayAction(spectated, random) : plausible;
    const before = {
      before: hand,
      beforeJson: JSON.stringify(hand),
      spectated,
    };
    const result = act(hand, action);
    steps.push({ ...before, action, stray, result });
    if (result.ok) {
      hand = result.value.hand;
      continue;
    }
    if (stray) continue;
    const timeout = act(hand, { type: "timeout" });
    if (!timeout.ok) {
      throw new Error(
        `Seed ${seed}: stuck at ${JSON.stringify(spectated.decision)}: ${JSON.stringify(result.error)}`
      );
    }
    steps.push({
      ...before,
      action: { type: "timeout" },
      stray: false,
      result: timeout,
    });
    hand = timeout.value.hand;
  }
  throw new Error(`Seed ${seed}: no end after ${maxSteps} steps`);
}
