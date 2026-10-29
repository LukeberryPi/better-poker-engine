import type { KnownCard } from "../cards.ts";
import { evaluate, type HandType } from "../evaluation.ts";
import { randomBelow, type RandomSource } from "../random.ts";
import { err, ok, type Result } from "../result.ts";
import type { Range } from "./ranges.ts";

/** What pokerkit's `calculate_equities` takes besides the ranges. */
export type Simulation = {
  /** Board cards already dealt, possibly none. */
  readonly board: readonly KnownCard[];
  /** Hole cards each player ends with: 2 in hold'em. */
  readonly holeCount: number;
  /** Board cards at showdown: 5 in hold'em. */
  readonly boardCount: number;
  /** The cards still to come are drawn from this deck. */
  readonly deck: readonly KnownCard[];
  /** Each hand type wins an equal part of the pot, as high and low halves do. */
  readonly handTypes: readonly HandType[];
  readonly samples: number;
  readonly random: RandomSource;
};

/** `no_deal`: no combination per range avoids every repeated card, board included.
 * `no_hand`: a sampled deal in which no hand type forms a hand for anyone. */
export type EquityError =
  | {
      readonly code: "invalid_count";
      readonly field: "holeCount" | "boardCount" | "samples" | "players";
      readonly value: number;
    }
  | {
      readonly code: "too_many_hole_cards";
      readonly player: number;
      readonly cards: number;
    }
  | { readonly code: "too_many_board_cards"; readonly cards: number }
  | { readonly code: "no_deal" }
  | {
      readonly code: "not_enough_cards";
      readonly needed: number;
      readonly available: number;
    }
  | { readonly code: "no_hand" };

/** One combination per player. */
type Selection = readonly (readonly KnownCard[])[];

type Deal = {
  readonly holes: readonly (readonly KnownCard[])[];
  readonly board: readonly KnownCard[];
};

function isCount(value: number, minimum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum;
}

function invalidCount(simulation: Simulation): EquityError | null {
  const counts = [
    ["holeCount", simulation.holeCount, 0],
    ["boardCount", simulation.boardCount, 0],
    ["samples", simulation.samples, 1],
  ] as const;
  const invalid = counts.find(([, value, minimum]) => !isCount(value, minimum));
  if (invalid === undefined) return null;
  const [field, value] = invalid;
  return { code: "invalid_count", field, value };
}

/** pokerkit's valid selections, in the order of the product of the ranges. */
function selectionsOf(
  ranges: readonly Range[],
  board: readonly KnownCard[]
): Selection[] {
  const selections: Selection[] = [];
  const used = new Set(board);
  if (used.size < board.length) return selections;
  const playable = ranges.map((range) =>
    range.filter((combo) => new Set(combo).size === combo.length)
  );
  const chosen: (readonly KnownCard[])[] = [];
  const choose = (player: number): void => {
    const range = playable[player];
    if (range === undefined) {
      selections.push([...chosen]);
      return;
    }
    for (const combo of range) {
      if (combo.some((card) => used.has(card))) continue;
      for (const card of combo) used.add(card);
      chosen.push(combo);
      choose(player + 1);
      chosen.pop();
      for (const card of combo) used.delete(card);
    }
  };
  choose(0);
  return selections;
}

/** An ordered sample without replacement, as pokerkit's `random.sample`. */
function draw(
  pool: readonly KnownCard[],
  count: number,
  random: RandomSource
): KnownCard[] {
  const remaining = [...pool];
  const drawn: KnownCard[] = [];
  while (drawn.length < count) {
    drawn.push(...remaining.splice(randomBelow(remaining.length, random), 1));
  }
  return drawn;
}

/** pokerkit's deal: the cards still to come go to each player in turn, then to the board. */
function dealOf(
  selection: Selection,
  simulation: Simulation,
  deck: readonly KnownCard[]
): Result<Deal, EquityError> {
  const { board, holeCount, boardCount, random } = simulation;
  const used = new Set([...board, ...selection.flat()]);
  const pool = deck.filter((card) => !used.has(card));
  const needed = holeCount * selection.length + boardCount - used.size;
  if (needed > pool.length) {
    return err({ code: "not_enough_cards", needed, available: pool.length });
  }
  const drawn = draw(pool, needed, random);
  let next = 0;
  const holes = selection.map((combo) => {
    const end = next + holeCount - combo.length;
    const hole = [...combo, ...drawn.slice(next, end)];
    next = end;
    return hole;
  });
  return ok({ holes, board: [...board, ...drawn.slice(next)] });
}

/** Each hand type splits its part among its best hands; null if players hold
 * cards but no hand type forms a hand. Adds in pokerkit's order. */
function withShares(
  totals: readonly number[],
  deal: Deal,
  handTypes: readonly HandType[]
): readonly number[] | null {
  const outcomes = handTypes.flatMap((type) => {
    const strengths = deal.holes.map(
      (hole) => evaluate(type, hole, deal.board)?.strength
    );
    const formed = strengths.filter((strength) => strength !== undefined);
    if (formed.length === 0) return [];
    const best = Math.max(...formed);
    const winners = formed.filter((strength) => strength === best).length;
    return [{ strengths, best, winners }];
  });
  if (outcomes.length === 0 && deal.holes.length > 0) return null;
  return totals.map((total, player) => {
    const won = outcomes.reduce(
      (share, { strengths, best, winners }) =>
        strengths[player] === best ? share + 1 / winners : share,
      0
    );
    return total + won / outcomes.length;
  });
}

/** pokerkit's `calculate_equities`: each player's share of the pot by Monte Carlo. */
export function equities(
  input: Simulation & { readonly ranges: readonly Range[] }
): Result<readonly number[], EquityError> {
  const { ranges, board, holeCount, boardCount, samples, random } = input;
  const invalid = invalidCount(input);
  if (invalid !== null) return err(invalid);
  if (board.length > boardCount) {
    return err({ code: "too_many_board_cards", cards: board.length });
  }
  for (const [player, range] of ranges.entries()) {
    const oversized = range.find((combo) => combo.length > holeCount);
    if (oversized !== undefined) {
      return err({
        code: "too_many_hole_cards",
        player,
        cards: oversized.length,
      });
    }
  }
  const selections = selectionsOf(ranges, board);
  if (selections.length === 0) return err({ code: "no_deal" });
  const deck = [...new Set(input.deck)];
  let totals: readonly number[] = ranges.map(() => 0);
  for (let sample = 0; sample < samples; sample += 1) {
    const chosen = randomBelow(selections.length, random);
    // SAFETY: randomBelow returns an index below the number of selections.
    const deal = dealOf(selections[chosen] as Selection, input, deck);
    if (!deal.ok) return deal;
    const shared = withShares(totals, deal.value, input.handTypes);
    if (shared === null) return err({ code: "no_hand" });
    totals = shared;
  }
  return ok(totals.map((total) => total / samples));
}

/** pokerkit's `calculate_hand_strength`: the equity of `range` against
 * `players - 1` random hands, which are dealt first. */
export function handStrength(
  input: Simulation & { readonly players: number; readonly range: Range }
): Result<number, EquityError> {
  const { players, range } = input;
  if (!isCount(players, 1)) {
    return err({ code: "invalid_count", field: "players", value: players });
  }
  const opponents = Array.from({ length: players - 1 }, (): Range => [[]]);
  const shares = equities({ ...input, ranges: [...opponents, range] });
  if (!shares.ok) return shares;
  // SAFETY: equities returns one share per range, and `range` is the last.
  return ok(shares.value[players - 1] as number);
}
