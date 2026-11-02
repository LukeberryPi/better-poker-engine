import { isKnownCard } from "../cards.ts";
import type { Chips } from "../chips.ts";
import { describeHand } from "../evaluation.ts";
import type {
  HandEvent,
  HandRecord,
  PlayerRecord,
  PotRecord,
} from "../events.ts";
import type { HoleCard } from "../hand.ts";
import { engineVersion } from "../version.ts";
import {
  allFaceUp,
  at,
  boardCards,
  boardCount,
  playerAt,
  positionsOf,
  sum,
  upHandOf,
  type ContestedPot,
  type HandState,
  type Position,
} from "./state.ts";

/** Hole cards as dealt, minus discards, face up once shown; a show keeps no card back. */
function heldCards(state: HandState, position: Position): HoleCard[] {
  const player = playerAt(state, position);
  let held: HoleCard[] = [];
  for (const { body } of state.events) {
    if (body.type === "holeDealt" && body.player === player) {
      held = [...held, ...body.cards];
    } else if (body.type === "drew" && body.player === player) {
      const discarded = [...body.discarded];
      held = held.filter(({ card }) => {
        const index = discarded.indexOf(card);
        if (index === -1) return true;
        discarded.splice(index, 1);
        return false;
      });
    } else if (body.type === "shown" && body.player === player) {
      for (const card of body.cards.filter(isKnownCard)) {
        const index = held.findIndex((hole) => hole.card === card);
        const unknown = held.findIndex((hole) => !isKnownCard(hole.card));
        const slot = index === -1 ? unknown : index;
        if (slot !== -1) held[slot] = { card, face: "up" };
      }
    }
  }
  return held;
}

function streetOfFirst(
  events: readonly HandEvent[],
  matches: (event: HandEvent) => boolean
): number | null {
  const event = events.find(matches);
  return event === undefined ? null : (event.street ?? 0);
}

function playerRecord(state: HandState, position: Position): PlayerRecord {
  const player = playerAt(state, position);
  return {
    player,
    position,
    startingStack: at(state.startingStacks, position),
    endingStack: at(state.stacks, position),
    net: at(state.payoffs, position),
    holeCards: heldCards(state, position),
    foldedOnStreet: streetOfFirst(
      state.events,
      ({ body }) => body.type === "folded" && body.player === player
    ),
    allInOnStreet: streetOfFirst(
      state.events,
      ({ after }) => after.stacks[position] === 0
    ),
  };
}

type Winner = PotRecord["winners"][number];

function winnersOf(state: HandState, pot: number): Winner[] {
  return state.events.flatMap(({ body }) => {
    if (body.type !== "chipsPushed" || body.pot !== pot) return [];
    const { board, handType } = body;
    return body.awards.map(({ player, amount }) => {
      const position = state.players.indexOf(player);
      const value =
        board !== null && handType !== null
          ? upHandOf(state, position, board, handType)
          : allFaceUp(state, position)
            ? upHandOf(state, position, 0, 0)
            : null;
      return {
        player,
        amount,
        hand: value === null ? null : describeHand(value),
      };
    });
  });
}

/** The contested pots that a pushed pot merged, main pot first. */
function partsOf(contested: ContestedPot[], amount: Chips): ContestedPot[] {
  const parts: ContestedPot[] = [];
  let covered = 0;
  while (covered < amount) {
    const part = contested.shift();
    if (part === undefined) throw new Error("Contested pots ran out");
    parts.push(part);
    covered += part.amount;
  }
  if (covered !== amount) throw new Error("Contested pots split a pushed pot");
  return parts;
}

/** Each row is a part's share of every flow, by largest remainder; rows and columns add up. */
function apportion(
  parts: readonly Chips[],
  flows: readonly Chips[]
): Chips[][] {
  const remaining = flows.map(BigInt);
  let left = BigInt(sum(parts));
  return parts.map((part) => {
    const size = BigInt(part);
    const shares = remaining.map((flow) => (flow * size) / left);
    const remainders = remaining.map((flow) => (flow * size) % left);
    let short = size - shares.reduce((total, share) => total + share, 0n);
    const order = remainders
      .map((remainder, index) => ({ remainder, index }))
      .filter(({ remainder }) => remainder > 0n)
      .sort((a, b) =>
        a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1
      );
    for (const { index } of order) {
      if (short === 0n) break;
      shares[index] = at(shares, index) + 1n;
      short -= 1n;
    }
    for (const [index, share] of shares.entries()) {
      remaining[index] = at(remaining, index) - share;
    }
    left -= size;
    return shares.map(Number);
  });
}

function potRecords(state: HandState): PotRecord[] {
  const contested = [...(state.contestedPots ?? [])];
  return (state.pots ?? []).flatMap((pot, index) => {
    const winners = winnersOf(state, index);
    const awarded = winners.map(({ amount }) => amount);
    const parts = partsOf(contested, pot.raked + pot.unraked + sum(awarded));
    const shares = apportion(
      parts.map(({ amount }) => amount),
      [pot.raked, pot.unraked, ...awarded]
    );
    return parts.map((part, row): PotRecord => {
      const [raked = 0, , ...awards] = at(shares, row);
      return {
        amount: part.amount,
        raked,
        eligible: part.eligible.map((position) => playerAt(state, position)),
        winners: winners.flatMap((winner, column) => {
          const amount = awards[column] ?? 0;
          return amount === 0 ? [] : [{ ...winner, amount }];
        }),
      };
    });
  });
}

/** Null until the hand is complete. */
export function summarize(state: HandState): HandRecord | null {
  if (state.phase.kind !== "complete") return null;
  const players = positionsOf(state).map((position) =>
    playerRecord(state, position)
  );
  const pots = state.pots ?? [];
  const streets = state.events.flatMap(({ street }) =>
    street === null ? [] : [street]
  );
  return {
    engineVersion,
    variant: state.game.variant,
    mode: state.game.mode,
    players,
    boards: Array.from({ length: boardCount(state) }, (_, board) =>
      boardCards(state, board)
    ),
    pots: potRecords(state),
    rake: sum(pots.map((pot) => pot.raked)),
    unclaimed: sum(pots.map((pot) => pot.unraked)),
    runouts: state.runoutCount ?? 1,
    streetsReached: streets.length === 0 ? 0 : Math.max(...streets) + 1,
    actions: state.events.filter(({ cause }) => cause.kind === "action").length,
    wentToShowdown:
      players.filter(({ foldedOnStreet }) => foldedOnStreet === null).length >
      1,
  };
}
