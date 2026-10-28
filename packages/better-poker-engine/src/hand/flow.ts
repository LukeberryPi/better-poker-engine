import type { Cause, EventBody, HandEvent, Snapshot } from "../events.ts";
import type {
  Action,
  AutomatedStep,
  Decision,
  PlayerId,
  Violation,
} from "../hand.ts";
import { err, ok, type Result } from "../result.ts";
import type { Pot } from "../views.ts";
import {
  beginBetting,
  betOrRaiseTo,
  bettingOver,
  bringInAmount,
  callAmount,
  checkOrCall,
  endBetting,
  fold,
  postBringIn,
  raiseRange,
} from "./betting.ts";
import {
  beginDealing,
  burnCard,
  canBurn,
  dealBoard,
  dealHole,
  draw,
  drawer,
  holeDealee,
  nextBoard,
} from "./dealing.ts";
import {
  beginBetCollection,
  beginBlindPosting,
  collectBets,
  postAnte,
  postBlind,
} from "./forced.ts";
import {
  beginChipsPulling,
  beginChipsPushing,
  potsOf,
  pullChips,
  pushChips,
} from "./pots.ts";
import type { Refusal } from "./refusal.ts";
import {
  beginHandKilling,
  beginShowdown,
  endShowdown,
  killHand,
  selectRunoutCount,
  showdownOver,
  showOrMuck,
} from "./showdown.ts";
import {
  activeCount,
  at,
  isLastStreet,
  maxBet,
  playerAt,
  positionsOf,
  type Betting,
  type Dealing,
  type HandState,
  type Position,
  type PotState,
} from "./state.ts";

function phaseOver(state: HandState): boolean {
  const { phase } = state;
  switch (phase.kind) {
    case "antePosting":
    case "blindPosting":
    case "handKilling":
    case "chipsPulling":
      return !phase.pending.includes(true);
    case "betCollection":
      return !phase.pending;
    case "dealing":
      return (
        !phase.burn &&
        phase.hole.every((faces) => faces.length === 0) &&
        phase.board.every((count) => count === 0) &&
        !phase.draw.includes(true)
      );
    case "betting":
      return bettingOver(state);
    case "showdown":
      return showdownOver(state);
    case "chipsPushing":
      return phase.subPots.length === 0;
    case "complete":
      return false;
  }
}

/** pokerkit's `_end_bet_collection`, including the jump back for another runout. */
function afterBetCollection(state: HandState): void {
  const { runout } = state;
  if (isLastStreet(state) && runout !== null && runout.remaining > 0) {
    state.street = runout.returnStreet - 1;
    runout.remaining -= 1;
  }
  if (activeCount(state) === 1) beginChipsPushing(state);
  else if (state.street === null) beginBlindPosting(state);
  else if (isLastStreet(state) || state.allIn) beginShowdown(state);
  else beginDealing(state);
}

function finishPhase(state: HandState): void {
  switch (state.phase.kind) {
    case "antePosting":
      return beginBetCollection(state);
    case "betCollection":
      return afterBetCollection(state);
    case "blindPosting":
      return beginDealing(state);
    case "dealing":
      return beginBetting(state);
    case "betting":
      endBetting(state);
      return beginBetCollection(state);
    case "showdown":
      return endShowdown(state) ? beginDealing(state) : beginHandKilling(state);
    case "handKilling":
      return beginChipsPushing(state);
    case "chipsPushing":
      return beginChipsPulling(state);
    case "chipsPulling":
      state.phase = { kind: "complete" };
      return;
    case "complete":
      return;
  }
}

/** Runs every phase change due, as pokerkit's `_update_*` methods do. */
export function settle(state: HandState): void {
  while (phaseOver(state)) finishPhase(state);
}

function idsOf(state: HandState, pending: readonly boolean[]): PlayerId[] {
  return positionsOf(state)
    .filter((position) => pending[position])
    .map((position) => playerAt(state, position));
}

function bettingDecision(state: HandState, phase: Betting): Decision {
  const actor = at(phase.actors, 0);
  const player = playerAt(state, actor);
  const range = raiseRange(state, undefined);
  const betOrRaiseTo = range.ok ? range.value : null;
  if (phase.bringIn) {
    return {
      kind: "betting",
      player,
      fold: null,
      checkOrCall: null,
      betOrRaiseTo,
      bringIn: bringInAmount(state, actor),
    };
  }
  const needless = at(state.bets, actor) >= maxBet(state);
  const amount = callAmount(state, actor);
  return {
    kind: "betting",
    player,
    fold: foldKind(state, needless),
    checkOrCall:
      amount === 0
        ? { kind: "check" }
        : { kind: "call", amount, allIn: amount === at(state.stacks, actor) },
    betOrRaiseTo,
    bringIn: null,
  };
}

function foldKind(
  state: HandState,
  needless: boolean
): "standard" | "needless" | null {
  if (!needless) return "standard";
  return state.game.mode === "tournament" ? null : "needless";
}

function dealingDecision(state: HandState, phase: Dealing): Decision {
  const drawing = drawer(state);
  if (drawing !== null) {
    return {
      kind: "drawing",
      player: playerAt(state, drawing),
      maxDiscards: at(state.hole, drawing).length,
    };
  }
  if (canBurn(phase)) return { kind: "dealer", step: "cardBurning" };
  const dealee = holeDealee(state);
  if (dealee !== null) {
    return {
      kind: "dealer",
      step: "holeDealing",
      player: playerAt(state, dealee),
      cards: at(phase.hole, dealee).length,
    };
  }
  const board = nextBoard(state);
  if (board === null) throw new Error("Dealing has nothing left to deal");
  return { kind: "dealer", step: "boardDealing", ...board };
}

export function decisionOf(state: HandState): Decision {
  const { phase } = state;
  switch (phase.kind) {
    case "antePosting":
    case "blindPosting":
    case "handKilling":
    case "chipsPulling":
      return {
        kind: "dealer",
        step: phase.kind,
        players: idsOf(state, phase.pending),
      };
    case "betCollection":
      return { kind: "dealer", step: "betCollection" };
    case "dealing":
      return dealingDecision(state, phase);
    case "betting":
      return bettingDecision(state, phase);
    case "showdown":
      if (phase.selectors.includes(true)) {
        return {
          kind: "runoutSelection",
          players: idsOf(state, phase.selectors),
        };
      }
      return { kind: "showdown", player: playerAt(state, at(phase.order, 0)) };
    case "chipsPushing":
      return { kind: "dealer", step: "chipsPushing" };
    case "complete":
      return { kind: "complete" };
  }
}

function decisionKind(state: HandState): Decision["kind"] {
  const { phase } = state;
  switch (phase.kind) {
    case "betting":
      return "betting";
    case "dealing":
      return drawer(state) === null ? "dealer" : "drawing";
    case "showdown":
      return phase.selectors.includes(true) ? "runoutSelection" : "showdown";
    case "complete":
      return "complete";
    default:
      return "dealer";
  }
}

export function potView(state: HandState, pot: PotState): Pot {
  return {
    amount: pot.raked + pot.unraked,
    raked: pot.raked,
    eligible: pot.eligible.map((position) => playerAt(state, position)),
  };
}

function snapshotOf(state: HandState): Snapshot {
  return {
    stacks: [...state.stacks],
    bets: [...state.bets],
    pots: potsOf(state).map((pot) => potView(state, pot)),
    waitingFor: decisionKind(state),
  };
}

function record(
  state: HandState,
  events: HandEvent[],
  cause: Cause,
  street: number | null,
  body: EventBody,
  commentary: string | null
): void {
  settle(state);
  state.version += 1;
  events.push({
    seq: state.version,
    cause,
    street,
    body,
    after: snapshotOf(state),
    commentary,
  });
}

function automatedSteps(state: HandState): readonly AutomatedStep[] {
  switch (state.phase.kind) {
    case "antePosting":
    case "betCollection":
    case "blindPosting":
    case "handKilling":
    case "chipsPushing":
    case "chipsPulling":
      return [state.phase.kind];
    case "dealing":
      return ["cardBurning", "holeDealing", "boardDealing"];
    case "showdown":
      return ["runoutCountSelection", "holeCardsShowingOrMucking"];
    case "betting":
    case "complete":
      return [];
  }
}

function performStep(
  state: HandState,
  step: AutomatedStep
): Result<EventBody, Refusal> {
  switch (step) {
    case "antePosting":
      return postAnte(state, undefined);
    case "betCollection":
      return collectBets(state);
    case "blindPosting":
      return postBlind(state, undefined);
    case "cardBurning":
      return burnCard(state, undefined);
    case "holeDealing":
      return dealHole(state, undefined, undefined);
    case "boardDealing":
      return dealBoard(state, undefined);
    case "runoutCountSelection":
      return selectRunoutCount(state, null, undefined);
    case "holeCardsShowingOrMucking":
      return showOrMuck(state, { kind: "default" }, undefined);
    case "handKilling":
      return killHand(state, undefined);
    case "chipsPushing":
      return pushChips(state);
    case "chipsPulling":
      return pullChips(state, undefined);
  }
}

/** Runs automated steps until a decision nobody automated, as pokerkit does. */
export function automate(state: HandState, events: HandEvent[]): void {
  for (;;) {
    const steps = automatedSteps(state).filter((step) =>
      state.automate.includes(step)
    );
    let performed = false;
    for (const step of steps) {
      const street = state.street;
      const body = performStep(state, step);
      if (!body.ok) continue;
      record(
        state,
        events,
        { kind: "automation", step },
        street,
        body.value,
        null
      );
      performed = true;
      break;
    }
    if (!performed) return;
  }
}

function timeout(
  state: HandState,
  player: Position | undefined
): Result<EventBody, Refusal> {
  const { phase } = state;
  switch (phase.kind) {
    case "betting": {
      const actor = phase.actors[0];
      if (actor === undefined) return err({ code: "not_now" });
      if (phase.bringIn) return postBringIn(state, player);
      return callAmount(state, actor) === 0
        ? checkOrCall(state, player)
        : fold(state, player);
    }
    case "dealing":
      return drawer(state) === null
        ? err({ code: "not_now" })
        : draw(state, [], player);
    case "showdown":
      return phase.selectors.includes(true)
        ? selectRunoutCount(state, null, player)
        : showOrMuck(state, { kind: "default" }, player);
    default:
      return err({ code: "not_now" });
  }
}

function perform(
  state: HandState,
  action: Action,
  player: Position | undefined
): Result<EventBody, Refusal> {
  switch (action.type) {
    case "fold":
      return fold(state, player);
    case "checkOrCall":
      return checkOrCall(state, player);
    case "postBringIn":
      return postBringIn(state, player);
    case "betOrRaiseTo":
      return betOrRaiseTo(state, action.amount, player);
    case "draw":
      return draw(state, action.discard, player);
    case "selectRunoutCount":
      return selectRunoutCount(state, action.count, player);
    case "show":
      return showOrMuck(state, { kind: "show", cards: action.cards }, player);
    case "muck":
      return showOrMuck(state, { kind: "muck" }, player);
    case "timeout":
      return timeout(state, player);
    case "postAnte":
      return postAnte(state, player);
    case "collectBets":
      return collectBets(state);
    case "postBlind":
      return postBlind(state, player);
    case "burnCard":
      return burnCard(state, action.card);
    case "dealHole":
      return dealHole(state, action.cards, player);
    case "dealBoard":
      return dealBoard(state, action.cards);
    case "killHand":
      return killHand(state, player);
    case "pushChips":
      return pushChips(state);
    case "pullChips":
      return pullChips(state, player);
  }
}

function namedPlayer(action: Action): PlayerId | undefined {
  switch (action.type) {
    case "collectBets":
    case "burnCard":
    case "dealBoard":
    case "pushChips":
      return undefined;
    default:
      return action.player;
  }
}

function positionOf(
  state: HandState,
  action: Action
): Result<Position | undefined, Violation> {
  const player = namedPlayer(action);
  if (player === undefined) return ok(undefined);
  const position = state.players.indexOf(player);
  if (position === -1) return err({ code: "unknown_player", player });
  return ok(position);
}

/** Validates against `state`, then applies the action to it in place. */
export function apply(
  state: HandState,
  action: Action,
  commentary: string | null
): Result<readonly HandEvent[], Violation> {
  const player = positionOf(state, action);
  if (!player.ok) return player;
  const street = state.street;
  const waitingFor = decisionKind(state);
  const body = perform(state, action, player.value);
  if (!body.ok) {
    const refusal = body.error;
    return err(
      refusal.code === "not_now"
        ? { code: "not_now", attempted: action.type, waitingFor }
        : refusal
    );
  }
  const events: HandEvent[] = [];
  record(
    state,
    events,
    { kind: "action", action },
    street,
    body.value,
    commentary
  );
  automate(state, events);
  return ok(events);
}
