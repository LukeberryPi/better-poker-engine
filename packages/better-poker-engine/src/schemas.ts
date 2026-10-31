import * as z from "zod/mini";

import { allCards } from "./cards.ts";
import type { Action, PlayerAction } from "./hand.ts";

const card = z.enum(allCards);
const cards = z.readonly(z.array(card));
const by = { player: z.exactOptional(z.string()) };

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
