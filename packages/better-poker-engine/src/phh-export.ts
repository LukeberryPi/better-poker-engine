import type { Card } from "./cards.ts";
import type { EventBody } from "./events.ts";
import type { Hand, PlayerId } from "./hand.ts";
import { stateOf, type HandState } from "./hand/state.ts";
import type { PhhAction } from "./phh-actions.ts";
import { fromChips, type AmountScale } from "./phh-amounts.ts";
import type { Phh } from "./phh.ts";
import { err, ok, type Result } from "./result.ts";

/** PHH names pokerkit's games only, deals one board, runs it once and has no
 * rake field: a history of any other hand would replay as a different hand. */
export type HistoryExportError =
  | { readonly code: "custom_variant" }
  | { readonly code: "boards"; readonly boards: number }
  | { readonly code: "runouts"; readonly runouts: number }
  | { readonly code: "rake" }
  /** PHH requires `bring_in` in stud games. */
  | { readonly code: "no_bring_in" };

export type ExportOptions = {
  /** Chips per whole amount, e.g. 100 writes 29 chips as 0.29. Defaults to 1. */
  readonly amountScale?: AmountScale;
};

type Cards = readonly [Card, ...Card[]];

function cardsOf(cards: readonly Card[]): Cards | null {
  const [first, ...rest] = cards;
  return first === undefined ? null : [first, ...rest];
}

type Seat = (player: PlayerId) => number;

function dealingAction(
  body: Extract<EventBody, { readonly type: "holeDealt" | "boardDealt" }>,
  seat: Seat,
  commentary: string
): PhhAction {
  const cards =
    body.type === "holeDealt"
      ? cardsOf(body.cards.map(({ card }) => card))
      : cardsOf(body.cards);
  if (cards === null) return { type: "noOp", commentary };
  return body.type === "holeDealt"
    ? { type: "dealHole", player: seat(body.player), cards, commentary }
    : { type: "dealBoard", cards, commentary };
}

/** pokerkit's `from_game_state` writes nothing for the dealer's other steps. */
function playerAction(
  body: EventBody,
  seat: Seat,
  commentary: string | null,
  scale: AmountScale
): PhhAction | null {
  switch (body.type) {
    case "drew":
      return {
        type: "draw",
        player: seat(body.player),
        discard: body.discarded,
        commentary,
      };
    case "bringInPosted":
      return { type: "postBringIn", player: seat(body.player), commentary };
    case "folded":
      return { type: "fold", player: seat(body.player), commentary };
    case "checked":
    case "called":
      return { type: "checkOrCall", player: seat(body.player), commentary };
    case "betOrRaised":
      return {
        type: "betOrRaiseTo",
        player: seat(body.player),
        amount: fromChips(body.to, scale),
        commentary,
      };
    case "shown":
      return {
        type: "show",
        player: seat(body.player),
        cards: cardsOf(body.cards),
        commentary,
      };
    case "mucked":
      return { type: "muck", player: seat(body.player), commentary };
    default:
      return commentary === null ? null : { type: "noOp", commentary };
  }
}

/** pokerkit's `from_game_state`: dealing is held until another event, then
 * written hole cards first, one action per player. A dealing event with
 * commentary is written alone, so the commentary stays with its cards. */
function actionsOf(state: HandState, scale: AmountScale): PhhAction[] {
  const seat: Seat = (player) => state.players.indexOf(player) + 1;
  const actions: PhhAction[] = [];
  const hole = new Map<number, Card[]>();
  const board: Card[] = [];
  const flush = (): void => {
    for (const [player, held] of [...hole].sort(([a], [b]) => a - b)) {
      const cards = cardsOf(held);
      if (cards === null) continue;
      actions.push({ type: "dealHole", player, cards, commentary: null });
    }
    hole.clear();
    const cards = cardsOf(board);
    if (cards !== null) {
      actions.push({ type: "dealBoard", cards, commentary: null });
    }
    board.length = 0;
  };
  for (const { body, commentary } of state.events) {
    if (body.type !== "holeDealt" && body.type !== "boardDealt") {
      flush();
      const action = playerAction(body, seat, commentary, scale);
      if (action !== null) actions.push(action);
    } else if (commentary !== null) {
      flush();
      actions.push(dealingAction(body, seat, commentary));
    } else if (body.type === "holeDealt") {
      const player = seat(body.player);
      const held = hole.get(player) ?? [];
      hole.set(player, [...held, ...body.cards.map(({ card }) => card)]);
    } else {
      board.push(...body.cards);
    }
  }
  flush();
  return actions;
}

/** pokerkit's `HandHistory.from_game_state`, so `replayHistory` of the result
 * plays the same hand. Metadata such as `players` is left for the caller. */
export function historyFromHand(
  hand: Hand,
  options: ExportOptions = {}
): Result<Phh, HistoryExportError> {
  const state = stateOf(hand);
  const { game } = state;
  if (game.variant === "custom") return err({ code: "custom_variant" });
  if (game.boards !== 1) return err({ code: "boards", boards: game.boards });
  const runouts = state.runoutCount ?? 1;
  if (runouts !== 1) return err({ code: "runouts", runouts });
  if (game.rake.kind !== "none") return err({ code: "rake" });
  const scale = options.amountScale ?? 1;
  const amount = (chips: number) => fromChips(chips, scale);
  const [first, ...rest] = game.rules.streets;
  const smallBet = amount(first.minCompletionBetOrRaise);
  const bigBet = amount((rest.at(-1) ?? first).minCompletionBetOrRaise);
  const details = {
    anteTrimming: game.forcedBets.anteTrimming,
    antes: state.antes.map(amount),
    startingStacks: state.startingStacks.map((stack) =>
      stack === "unbounded" ? stack : amount(stack)
    ),
    actions: actionsOf(state, scale),
    author: null,
    event: null,
    url: null,
    venue: null,
    address: null,
    city: null,
    region: null,
    postalCode: null,
    country: null,
    time: null,
    timeZone: null,
    timeZoneAbbreviation: null,
    day: null,
    month: null,
    year: null,
    hand: null,
    level: null,
    seats: null,
    seatCount: null,
    table: null,
    players: null,
    finishingStacks: null,
    winnings: null,
    currency: null,
    currencySymbol: null,
    timeLimit: null,
    timeBanks: null,
    extra: {},
  };
  const blinds = state.blinds.map(amount);
  switch (game.variant) {
    case "FT":
    case "FO/8":
    case "F2L3D":
    case "FB":
      return ok({
        ...details,
        variant: game.variant,
        blinds,
        bringIn: null,
        smallBet,
        bigBet,
        minBet: null,
      });
    case "NT":
    case "NS":
    case "PO":
    case "N2L1D":
      return ok({
        ...details,
        variant: game.variant,
        blinds,
        bringIn: null,
        smallBet: null,
        bigBet: null,
        minBet: smallBet,
      });
    case "F7S":
    case "F7S/8":
    case "FR": {
      const { bringIn } = game.forcedBets;
      if (bringIn === null) return err({ code: "no_bring_in" });
      return ok({
        ...details,
        variant: game.variant,
        blinds: null,
        bringIn: amount(bringIn),
        smallBet,
        bigBet,
        minBet: null,
      });
    }
  }
}
