import * as z from "zod/mini";

import { allCards, decks } from "./cards.ts";
import { handRules } from "./evaluation.ts";
import type { HandEvent } from "./events.ts";
import {
  automation,
  type Action,
  type Decision,
  type HandSetup,
  type PlayerAction,
} from "./hand.ts";
import type { BettingStructure, Face, Game, Mode, Opening } from "./rules.ts";
import { variantCodes } from "./variants.ts";

function keysOf<Key extends string, Value>(
  record: Readonly<Record<Key, Value>>
): Key[] {
  // SAFETY: a Record<Key, Value> literal has exactly the keys Key.
  return Object.keys(record) as Key[];
}

const card = z.enum(allCards);
const cards = z.readonly(z.array(card));
const playerId = z.string();
const by = { player: z.exactOptional(playerId) };
const chips = z.number();
const stack = z.union([chips, z.literal("unbounded")]);

function action<
  const Type extends string,
  Fields extends Readonly<Record<string, z.core.SomeType>>,
>(type: Type, fields: Fields) {
  return z.readonly(z.object({ type: z.literal(type), ...fields }));
}

/** Everything a player may send. Parse client input with this, never `actionSchema`. */
export const playerActionSchema = z.discriminatedUnion("type", [
  action("fold", by),
  action("checkOrCall", by),
  action("postBringIn", by),
  action("betOrRaiseTo", { ...by, amount: z.number() }),
  action("draw", { ...by, discard: cards }),
  action("selectRunoutCount", { ...by, count: z.nullable(z.number()) }),
  action("show", { ...by, cards: z.exactOptional(cards) }),
  action("muck", by),
  action("timeout", by),
]) satisfies z.ZodMiniType<PlayerAction>;

/** Dealer steps included: for trusted callers such as replays, not client input. */
export const actionSchema = z.discriminatedUnion("type", [
  playerActionSchema,
  action("postAnte", by),
  action("collectBets", {}),
  action("postBlind", by),
  action("burnCard", { card: z.exactOptional(card) }),
  action("dealHole", { ...by, cards: z.exactOptional(cards) }),
  action("dealBoard", { cards: z.exactOptional(cards) }),
  action("killHand", by),
  action("pushChips", {}),
  action("pullChips", by),
]) satisfies z.ZodMiniType<Action>;

const face = z.enum(
  keysOf({ down: true, up: true } satisfies Record<Face, true>)
);
const automatedStep = z.enum(automation.all);

const openings = {
  position: true,
  lowCard: true,
  highCard: true,
  lowHand: true,
  highHand: true,
} satisfies Record<Opening, true>;

const structures = {
  fixedLimit: true,
  potLimit: true,
  noLimit: true,
} satisfies Record<BettingStructure, true>;

const modes = { tournament: true, cashGame: true } satisfies Record<Mode, true>;

function object<Fields extends Readonly<Record<string, z.core.SomeType>>>(
  fields: Fields
) {
  return z.readonly(z.object(fields));
}

function list<Item extends z.core.SomeType>(item: Item) {
  return z.readonly(z.array(item));
}

function nonEmpty<Item extends z.core.SomeType>(item: Item) {
  return z.readonly(z.tuple([item], item));
}

const street = object({
  burn: z.boolean(),
  hole: list(face),
  board: z.number(),
  draw: z.boolean(),
  opening: z.enum(keysOf(openings)),
  minCompletionBetOrRaise: chips,
  maxBetsAndRaises: z.nullable(z.number()),
});

const antes = z.discriminatedUnion("kind", [
  object({ kind: z.literal("none") }),
  object({ kind: z.literal("everyone"), amount: chips }),
  object({ kind: z.literal("button"), amount: chips }),
  object({ kind: z.literal("bigBlind"), amount: chips }),
  object({ kind: z.literal("byPosition"), amounts: list(chips) }),
]);

const rake = z.discriminatedUnion("kind", [
  object({ kind: z.literal("none") }),
  object({
    kind: z.literal("percentage"),
    basisPoints: z.number(),
    cap: z.nullable(chips),
    noFlopNoDrop: z.boolean(),
  }),
]);

export const gameSchema = object({
  variant: z.enum([...variantCodes, "custom"]),
  rules: object({
    deck: z.enum(keysOf(decks)),
    handTypes: nonEmpty(z.enum(keysOf(handRules))),
    streets: nonEmpty(street),
    structure: z.enum(keysOf(structures)),
  }),
  forcedBets: object({
    antes,
    blinds: list(z.number()),
    bringIn: z.nullable(chips),
    anteTrimming: z.boolean(),
  }),
  rake,
  mode: z.enum(keysOf(modes)),
  boards: z.number(),
}) satisfies z.ZodMiniType<Game>;

export const handSetupSchema = object({
  game: gameSchema,
  players: list(playerId),
  stacks: list(stack),
  deck: cards,
  automate: list(automatedStep),
}) satisfies z.ZodMiniType<HandSetup>;

const holeCard = object({ card, face });
const playerAmount = object({ player: playerId, amount: chips });

function body<
  const Type extends string,
  Fields extends Readonly<Record<string, z.core.SomeType>>,
>(type: Type, fields: Fields) {
  return object({ type: z.literal(type), ...fields });
}

const eventBody = z.discriminatedUnion("type", [
  body("antePosted", { player: playerId, amount: chips }),
  body("betsCollected", { collected: chips, returned: list(playerAmount) }),
  body("blindPosted", { player: playerId, amount: chips }),
  body("cardBurned", { card }),
  body("holeDealt", { player: playerId, cards: list(holeCard) }),
  body("boardDealt", { board: z.number(), cards }),
  body("drew", { player: playerId, discarded: cards }),
  body("folded", { player: playerId, needless: z.boolean() }),
  body("checked", { player: playerId }),
  body("called", { player: playerId, amount: chips, allIn: z.boolean() }),
  body("bringInPosted", { player: playerId, amount: chips }),
  body("betOrRaised", {
    player: playerId,
    kind: z.enum(["bet", "raise", "complete"]),
    to: chips,
    allIn: z.boolean(),
  }),
  body("runoutCountSelected", {
    player: playerId,
    count: z.nullable(z.number()),
  }),
  body("shown", { player: playerId, cards }),
  body("mucked", { player: playerId }),
  body("handKilled", { player: playerId }),
  body("chipsPushed", {
    pot: z.number(),
    board: z.nullable(z.number()),
    handType: z.nullable(z.number()),
    awards: list(playerAmount),
    unclaimed: chips,
  }),
  body("chipsPulled", { player: playerId, amount: chips }),
]);

const decisionKinds = {
  betting: true,
  drawing: true,
  runoutSelection: true,
  showdown: true,
  dealer: true,
  complete: true,
} satisfies Record<Decision["kind"], true>;

export const handEventSchema = object({
  seq: z.number(),
  cause: z.discriminatedUnion("kind", [
    object({ kind: z.literal("action"), action: actionSchema }),
    object({ kind: z.literal("automation"), step: automatedStep }),
  ]),
  street: z.nullable(z.number()),
  body: eventBody,
  after: object({
    stacks: list(stack),
    bets: list(chips),
    pots: list(
      object({ amount: chips, raked: chips, eligible: list(playerId) })
    ),
    waitingFor: z.enum(keysOf(decisionKinds)),
  }),
  commentary: z.nullable(z.string()),
}) satisfies z.ZodMiniType<HandEvent>;
