import { isKnownCard, type KnownCard } from "../cards.ts";
import type { HandSetup, SetupError } from "../hand.ts";
import { seedFrom } from "../random.ts";
import { validateGame, type Antes, type Game, type Street } from "../rules.ts";
import { beginAntePosting } from "./forced.ts";
import type { HandState, Position } from "./state.ts";

/** pokerkit's `clean_values`: negative positions count back from the last seat. */
export function perPosition(
  amounts: Iterable<readonly [Position, number]>,
  count: number
): number[] {
  const values = Array.from({ length: count }, () => 0);
  for (const [position, amount] of amounts) {
    const index = position < 0 ? count + position : position;
    const current = values[index];
    if (current !== undefined) values[index] = current + amount;
  }
  return values;
}

export function anteVector(antes: Antes, count: number): number[] {
  switch (antes.kind) {
    case "none":
      return perPosition([], count);
    case "everyone":
      return perPosition(
        Array.from({ length: count }, (_, position) => [
          position,
          antes.amount,
        ]),
        count
      );
    case "button":
      return perPosition([[-1, antes.amount]], count);
    case "bigBlind":
      return perPosition([[1, antes.amount]], count);
    case "byPosition":
      return perPosition(antes.amounts.entries(), count);
  }
}

function defaultPlayers(count: number): string[] {
  return Array.from({ length: count }, (_, position) => `p${position + 1}`);
}

export function validateSetup(setup: HandSetup): SetupError | null {
  const gameError = validateGame(setup.game);
  if (gameError !== null) return gameError;
  const { stacks } = setup;
  if (stacks.length < 2)
    return { code: "player_count", players: stacks.length };
  const players = setup.players ?? defaultPlayers(stacks.length);
  if (players.length !== stacks.length) {
    return { code: "player_ids", ids: players.length, stacks: stacks.length };
  }
  const seen = new Set<string>();
  for (const player of players) {
    if (seen.has(player)) return { code: "duplicate_player", player };
    seen.add(player);
  }
  for (const [position, stack] of stacks.entries()) {
    if (stack !== "unbounded" && (!Number.isSafeInteger(stack) || stack <= 0)) {
      return {
        code: "invalid_stack",
        player: players[position] ?? `p${position + 1}`,
        stack,
      };
    }
  }
  const cards = new Set<KnownCard>();
  for (const card of setup.deck.filter(isKnownCard)) {
    if (cards.has(card)) return { code: "duplicate_card", card };
    cards.add(card);
  }
  return null;
}

function copyStreet(street: Street): Street {
  return { ...street, hole: [...street.hole] };
}

/** A private copy, so later edits to the caller's objects never reach the hand. */
function copyGame(game: Game): Game {
  const { rules, forcedBets, rake } = game;
  const [first, ...rest] = rules.streets;
  const [handType, ...handTypes] = rules.handTypes;
  const antes: Antes =
    forcedBets.antes.kind === "byPosition"
      ? { kind: "byPosition", amounts: [...forcedBets.antes.amounts] }
      : { ...forcedBets.antes };
  return {
    ...game,
    rules: {
      ...rules,
      handTypes: [handType, ...handTypes],
      streets: [copyStreet(first), ...rest.map(copyStreet)],
    },
    forcedBets: { ...forcedBets, antes, blinds: [...forcedBets.blinds] },
    rake: { ...rake },
  };
}

export function initialState(setup: HandSetup): HandState {
  const count = setup.stacks.length;
  const game = copyGame(setup.game);
  const zeros = () => Array.from({ length: count }, () => 0);
  const empty = <T>(): T[][] => Array.from({ length: count }, (): T[] => []);
  const state: HandState = {
    game,
    players: [...(setup.players ?? defaultPlayers(count))],
    automate: [...setup.automate],
    antes: anteVector(game.forcedBets.antes, count),
    blinds: perPosition(game.forcedBets.blinds.entries(), count),
    startingStacks: [...setup.stacks],
    version: 0,
    deck: [...setup.deck],
    reshuffleSeed: seedFrom(setup.deck.join(" ")),
    boards: [],
    burned: [],
    mucked: [],
    discarded: game.rules.streets.map(() => []),
    active: Array.from({ length: count }, () => true),
    bets: zeros(),
    stacks: [...setup.stacks],
    payoffs: zeros(),
    hole: empty(),
    retired: empty(),
    street: null,
    runout: null,
    allIn: false,
    opener: null,
    runoutCount: null,
    runoutCountSelected: false,
    pots: null,
    phase: { kind: "complete" },
    events: [],
  };
  beginAntePosting(state);
  return state;
}
