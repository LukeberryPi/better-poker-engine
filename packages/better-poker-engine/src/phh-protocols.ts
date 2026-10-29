import { isKnownCard } from "./cards.ts";
import type { HandEvent } from "./events.ts";
import type { Hand, PlayerId } from "./hand.ts";
import { decisionOf } from "./hand/flow.ts";
import { stateOf } from "./hand/state.ts";
import { fromChips, type AmountScale } from "./phh-amounts.ts";
import {
  replayHistory,
  stacksAt,
  type HistoryReplay,
  type HistoryReplayError,
} from "./phh-replay.ts";
import type { Phh } from "./phh.ts";
import { err, ok, type Result } from "./result.ts";
import type { VariantCode } from "./variants.ts";

export type ProtocolOptions = {
  /** Defaults to the history's `hand` when it is an integer, as in pokerkit. */
  readonly handNumber?: number;
  /** As in `replayHistory`; amounts are written in the history's units. */
  readonly amountScale?: AmountScale;
};

type ProtocolError =
  | { readonly code: "unsupported_variant"; readonly variant: VariantCode }
  | { readonly code: "hand_number_required" }
  | HistoryReplayError;

export type AcpcError =
  | ProtocolError
  | { readonly code: "unknown_position"; readonly position: number }
  /** The dealer's messages carry the client's own hole cards. */
  | { readonly code: "hole_cards_unknown"; readonly position: number };

export type PluribusError =
  | ProtocolError
  /** Pluribus logs each player's net result, which an `inf` stack lacks. */
  | { readonly code: "unbounded_stack"; readonly position: number };

/** "S->" is the dealer's message to the client, "<-C" the client's reply. */
export type AcpcMessage = readonly [direction: "S->" | "<-C", message: string];

function handNumberOf(
  history: Phh,
  options: ProtocolOptions
): Result<number, ProtocolError> {
  const { hand } = history;
  if (options.handNumber !== undefined) return ok(options.handNumber);
  return hand === null || String(hand) === hand
    ? err({ code: "hand_number_required" })
    : ok(Number(hand));
}

/** What the logs show of the cards: two slots per seat, "" until known. */
type Table = {
  readonly holes: readonly string[][];
  readonly dealt: number[];
  board: string;
  boardStreet: number | null;
};

function tableFor(players: number): Table {
  return {
    holes: Array.from({ length: players }, () => ["", ""]),
    dealt: Array.from({ length: players }, () => 0),
    board: "",
    boardStreet: null,
  };
}

/** Returns whether the event began a street's board. pokerkit numbers slots and
 * adds "/" per dealing operation, which breaks histories that deal one card at
 * a time; here slots fill in dealing order and "/" comes once per street. */
function see(
  table: Table,
  event: HandEvent,
  seat: (player: PlayerId) => number,
  shownTo: (position: number) => boolean
): boolean {
  const { body } = event;
  switch (body.type) {
    case "holeDealt": {
      const position = seat(body.player);
      const first = table.dealt[position] ?? 0;
      table.dealt[position] = first + body.cards.length;
      const slots = table.holes[position];
      if (slots === undefined || !shownTo(position)) return false;
      for (const [index, { card }] of body.cards.entries()) {
        if (isKnownCard(card) && first + index < slots.length) {
          slots[first + index] = card;
        }
      }
      return false;
    }
    case "shown": {
      const slots = table.holes[seat(body.player)];
      if (slots === undefined) return false;
      for (const [index, card] of body.cards.entries()) {
        if (isKnownCard(card) && index < slots.length) slots[index] = card;
      }
      return false;
    }
    case "boardDealt": {
      const street = event.street !== table.boardStreet;
      table.board += `${street ? "/" : ""}${body.cards.join("")}`;
      table.boardStreet = event.street;
      return street;
    }
    default:
      return false;
  }
}

function cardsText(table: Table): string {
  const holes = table.holes.map((slots) => slots.join("")).join("|");
  return `${holes}${table.board}`;
}

type Bet = { readonly player: PlayerId; readonly letter: string };

/** No-limit raises are written as the raiser's total in the hand so far. */
function betOf(
  event: HandEvent,
  hand: Hand,
  noLimit: boolean,
  scale: AmountScale
): Bet | null {
  const { body } = event;
  switch (body.type) {
    case "folded":
      return { player: body.player, letter: "f" };
    case "checked":
    case "called":
      return { player: body.player, letter: "c" };
    case "betOrRaised": {
      if (!noLimit) return { player: body.player, letter: "r" };
      const state = stateOf(hand);
      const paid = -(state.payoffs[state.players.indexOf(body.player)] ?? 0);
      return { player: body.player, letter: `r${fromChips(paid, scale)}` };
    }
    default:
      return null;
  }
}

function seatsOf(replay: HistoryReplay): (player: PlayerId) => number {
  const { players } = stateOf(replay.final);
  return (player) => players.indexOf(player);
}

/** pokerkit's `HandHistory.to_acpc_protocol`: the messages between the dealer
 * and the client at `position` (from 0), for FT and NT histories. */
export function toAcpc(
  history: Phh,
  position: number,
  options: ProtocolOptions = {}
): Result<readonly AcpcMessage[], AcpcError> {
  if (history.variant !== "FT" && history.variant !== "NT") {
    return err({ code: "unsupported_variant", variant: history.variant });
  }
  const hand = handNumberOf(history, options);
  if (!hand.ok) return hand;
  const table = tableFor(history.startingStacks.length);
  const own = table.holes[position];
  if (own === undefined) return err({ code: "unknown_position", position });
  const scale = options.amountScale ?? 1;
  const replay = replayHistory(history, { amountScale: scale });
  if (!replay.ok) return replay;
  const seat = seatsOf(replay.value);
  const messages: AcpcMessage[] = [];
  let actions = "";
  let matchState = "";
  for (const step of replay.value.steps) {
    for (const event of step.events) {
      const bet = betOf(event, step.hand, history.variant === "NT", scale);
      if (bet !== null) {
        if (own.includes(""))
          return err({ code: "hole_cards_unknown", position });
        messages.push(["S->", `${matchState}\r\n`]);
        actions += bet.letter;
        if (seat(bet.player) === position) {
          messages.push(["<-C", `${matchState}:${bet.letter}\r\n`]);
        }
      }
      if (see(table, event, seat, (dealt) => dealt === position)) {
        actions += "/";
      }
      matchState = `MATCHSTATE:${position}:${hand.value}:${actions}:${cardsText(table)}`;
    }
  }
  const last = decisionOf(stateOf(replay.value.final)).kind;
  if (last === "complete" || last === "betting") {
    if (own.includes("")) return err({ code: "hole_cards_unknown", position });
    messages.push(["S->", `${matchState}\r\n`]);
  }
  return ok(messages);
}

/** pokerkit's `HandHistory.to_pluribus_protocol`, for NT histories. As in
 * pokerkit, results come from `finishing_stacks` when the history has them. */
export function toPluribus(
  history: Phh,
  options: ProtocolOptions = {}
): Result<string, PluribusError> {
  if (history.variant !== "NT") {
    return err({ code: "unsupported_variant", variant: history.variant });
  }
  const hand = handNumberOf(history, options);
  if (!hand.ok) return hand;
  const scale = options.amountScale ?? 1;
  const replay = replayHistory(history, { amountScale: scale });
  if (!replay.ok) return replay;
  const seat = seatsOf(replay.value);
  const table = tableFor(history.startingStacks.length);
  let actions = "";
  for (const step of replay.value.steps) {
    for (const event of step.events) {
      actions += betOf(event, step.hand, true, scale)?.letter ?? "";
      if (see(table, event, seat, () => true)) actions += "/";
    }
  }
  const finishing =
    history.finishingStacks === null
      ? ok(stateOf(replay.value.final).stacks)
      : stacksAt("finishing_stacks", history.finishingStacks, scale);
  if (!finishing.ok) return finishing;
  const payoffs: string[] = [];
  for (const [position, start] of replay.value.setup.stacks.entries()) {
    const end = finishing.value[position];
    if (start === "unbounded" || end === "unbounded" || end === undefined) {
      return err({ code: "unbounded_stack", position });
    }
    payoffs.push(fromChips(end - start, scale));
  }
  const players =
    history.players ??
    history.startingStacks.map((_, position) => `p${position + 1}`);
  return ok(
    `STATE:${hand.value}:${actions}:${cardsText(table)}:${payoffs.join("|")}:${players.join("|")}`
  );
}
