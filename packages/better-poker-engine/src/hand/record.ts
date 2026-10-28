import { isKnownCard } from "../cards.ts";
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
  at,
  boardCards,
  boardCount,
  playerAt,
  positionsOf,
  sum,
  upHandOf,
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
  const startingStack = at(state.startingStacks, position);
  const endingStack = at(state.stacks, position);
  return {
    player,
    position,
    startingStack,
    endingStack,
    net:
      startingStack === "unbounded" || endingStack === "unbounded"
        ? null
        : endingStack - startingStack,
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

function potRecords(state: HandState): PotRecord[] {
  return (state.pots ?? []).map((pot, index) => {
    const winners = state.events.flatMap(({ body }) => {
      if (body.type !== "chipsPushed" || body.pot !== index) return [];
      const { board, handType } = body;
      return body.awards.map(({ player, amount }) => {
        const position = state.players.indexOf(player);
        const value =
          board === null || handType === null
            ? null
            : upHandOf(state, position, board, handType);
        return {
          player,
          amount,
          hand: value === null ? null : describeHand(value),
        };
      });
    });
    return {
      amount:
        pot.raked + pot.unraked + sum(winners.map(({ amount }) => amount)),
      raked: pot.raked,
      eligible: pot.eligible.map((position) => playerAt(state, position)),
      winners,
    };
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
