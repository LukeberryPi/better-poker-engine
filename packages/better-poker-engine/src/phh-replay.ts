import { decks } from "./cards.ts";
import type { Stack } from "./chips.ts";
import type { HandEvent } from "./events.ts";
import {
  act,
  startHand,
  type Action,
  type Automation,
  type Hand,
  type HandSetup,
  type PlayerId,
  type SetupError,
  type Transition,
  type Violation,
} from "./hand.ts";
import { decisionOf } from "./hand/flow.ts";
import { stateOf } from "./hand/state.ts";
import { formatPhhAction, type PhhAction } from "./phh-actions.ts";
import {
  toBlindChips,
  toChips,
  type AmountScale,
  type ChipsError,
  type PhhDecimal,
} from "./phh-amounts.ts";
import type { Phh, PhhStack } from "./phh.ts";
import { err, ok, type Result } from "./result.ts";
import { draw, holdem, omaha, shortDeck, stud, type Game } from "./rules.ts";

export type ReplayStep = Transition & {
  /** The history's action as `formatPhhAction` writes it, or null for a step
   * the replay fills in, as pokerkit's `HandHistory.state_actions` does. */
  readonly action: string | null;
};

export type HistoryReplay = {
  /** Players are "p1".."pN", as in PHH actions; names stay in `history.players`. */
  readonly setup: HandSetup;
  /** The hand as it starts, then one step per action or filled-in step. */
  readonly steps: readonly ReplayStep[];
  readonly final: Hand;
};

export type HistoryReplayError =
  /** `field` names the amount as the document writes it, e.g. `actions[5]`. */
  | (ChipsError & { readonly field: string })
  | { readonly code: "setup"; readonly error: SetupError }
  /** The action at `index` still fails once pokerkit's fill-ins run out;
   * `violation` is why the engine first refused it. */
  | {
      readonly code: "rejected";
      readonly index: number;
      readonly action: string;
      readonly violation: Violation;
    };

export type ReplayOptions = {
  /** Chips per whole amount in the document, e.g. 100 for cents. Defaults to 1. */
  readonly amountScale?: AmountScale;
  /** Defaults to pokerkit's: every dealer step except dealing and showdowns. */
  readonly automate?: Automation;
};

const historyAutomation = [
  "antePosting",
  "betCollection",
  "blindPosting",
  "cardBurning",
  "runoutCountSelection",
  "handKilling",
  "chipsPushing",
  "chipsPulling",
] as const satisfies Automation;

type ToChips = (
  amount: PhhDecimal,
  scale: AmountScale
) => Result<number, ChipsError>;

function amountAt(
  field: string,
  amount: PhhDecimal,
  scale: AmountScale,
  convert: ToChips = toChips
): Result<number, HistoryReplayError> {
  const chips = convert(amount, scale);
  return chips.ok ? chips : err({ ...chips.error, field });
}

function amountsAt(
  field: string,
  amounts: readonly PhhDecimal[],
  scale: AmountScale,
  convert: ToChips = toChips
): Result<number[], HistoryReplayError> {
  const values: number[] = [];
  for (const [index, amount] of amounts.entries()) {
    const value = amountAt(`${field}[${index}]`, amount, scale, convert);
    if (!value.ok) return value;
    values.push(value.value);
  }
  return ok(values);
}

export function stacksAt(
  field: string,
  stacks: readonly PhhStack[],
  scale: AmountScale
): Result<Stack[], HistoryReplayError> {
  const values: Stack[] = [];
  for (const [index, stack] of stacks.entries()) {
    if (stack === "unbounded") {
      values.push(stack);
      continue;
    }
    const value = amountAt(`${field}[${index}]`, stack, scale);
    if (!value.ok) return value;
    values.push(value.value);
  }
  return ok(values);
}

const fixedLimitGames = {
  FT: holdem.fixedLimit,
  "FO/8": omaha.fixedLimitHiLo,
  F2L3D: draw.deuceToSevenTriple,
  FB: draw.badugi,
};

const minBetGames = {
  NT: holdem.noLimit,
  NS: shortDeck.noLimit,
  PO: omaha.potLimit,
  N2L1D: draw.deuceToSevenSingle,
};

const studGames = {
  F7S: stud.fixedLimit,
  "F7S/8": stud.fixedLimitHiLo,
  FR: stud.razz,
};

/** pokerkit's `HandHistory.create_game`: a cash game without rake. */
function historyGame(
  history: Phh,
  scale: AmountScale
): Result<Game, HistoryReplayError> {
  const antes = amountsAt("antes", history.antes, scale);
  if (!antes.ok) return antes;
  const options = {
    antes: { kind: "byPosition", amounts: antes.value },
    mode: "cashGame",
    anteTrimming: history.anteTrimming ?? false,
  } as const;
  switch (history.variant) {
    case "FT":
    case "FO/8":
    case "F2L3D":
    case "FB": {
      const blinds = amountsAt(
        "blinds_or_straddles",
        history.blinds,
        scale,
        toBlindChips
      );
      if (!blinds.ok) return blinds;
      const smallBet = amountAt("small_bet", history.smallBet, scale);
      if (!smallBet.ok) return smallBet;
      const bigBet = amountAt("big_bet", history.bigBet, scale);
      if (!bigBet.ok) return bigBet;
      return ok(
        fixedLimitGames[history.variant]({
          ...options,
          blinds: blinds.value,
          smallBet: smallBet.value,
          bigBet: bigBet.value,
        })
      );
    }
    case "NT":
    case "NS":
    case "PO":
    case "N2L1D": {
      const blinds = amountsAt(
        "blinds_or_straddles",
        history.blinds,
        scale,
        toBlindChips
      );
      if (!blinds.ok) return blinds;
      const minBet = amountAt("min_bet", history.minBet, scale);
      if (!minBet.ok) return minBet;
      return ok(
        minBetGames[history.variant]({
          ...options,
          blinds: blinds.value,
          minBet: minBet.value,
        })
      );
    }
    case "F7S":
    case "F7S/8":
    case "FR": {
      const bringIn = amountAt("bring_in", history.bringIn, scale);
      if (!bringIn.ok) return bringIn;
      const smallBet = amountAt("small_bet", history.smallBet, scale);
      if (!smallBet.ok) return smallBet;
      const bigBet = amountAt("big_bet", history.bigBet, scale);
      if (!bigBet.ok) return bigBet;
      return ok(
        studGames[history.variant]({
          ...options,
          bringIn: bringIn.value,
          smallBet: smallBet.value,
          bigBet: bigBet.value,
        })
      );
    }
  }
}

/** A history action ready for the engine; `action` is null for a no-op. */
type Pending = {
  readonly text: string;
  readonly action: Action | null;
  readonly commentary: string | null;
};

function playerOf(action: { readonly player: number }): PlayerId {
  return `p${action.player}`;
}

function engineAction(
  action: PhhAction,
  index: number,
  scale: AmountScale
): Result<Action | null, HistoryReplayError> {
  switch (action.type) {
    case "dealHole":
      return ok({
        type: "dealHole",
        player: playerOf(action),
        cards: action.cards,
      });
    case "dealBoard":
      return ok({ type: "dealBoard", cards: action.cards });
    case "draw":
      return ok({
        type: "draw",
        player: playerOf(action),
        discard: action.discard,
      });
    case "postBringIn":
    case "fold":
    case "checkOrCall":
    case "muck":
      return ok({ type: action.type, player: playerOf(action) });
    case "betOrRaiseTo": {
      const amount = amountAt(`actions[${index}]`, action.amount, scale);
      if (!amount.ok) return amount;
      return ok({
        type: "betOrRaiseTo",
        player: playerOf(action),
        amount: amount.value,
      });
    }
    case "show":
      return ok(
        action.cards === null
          ? { type: "show", player: playerOf(action) }
          : { type: "show", player: playerOf(action), cards: action.cards }
      );
    case "noOp":
      return ok(null);
  }
}

function pendingActions(
  actions: readonly PhhAction[],
  scale: AmountScale
): Result<Pending[], HistoryReplayError> {
  const pending: Pending[] = [];
  for (const [index, action] of actions.entries()) {
    const converted = engineAction(action, index, scale);
    if (!converted.ok) return converted;
    pending.push({
      text: formatPhhAction(action),
      action: converted.value,
      commentary: action.commentary,
    });
  }
  return ok(pending);
}

function inProgress(hand: Hand): boolean {
  return stateOf(hand).phase.kind !== "complete";
}

function canCheck(hand: Hand): boolean {
  const decision = decisionOf(stateOf(hand));
  return decision.kind === "betting" && decision.checkOrCall?.kind === "check";
}

type Repair = {
  readonly action: Action;
  readonly applies: (hand: Hand, actionsLeft: boolean) => boolean;
};

function always(action: Action): Repair {
  return { action, applies: () => true };
}

/** What pokerkit's `state_actions` tries, in order, when no history action applies. */
const repairs: readonly Repair[] = [
  always({ type: "postAnte" }),
  always({ type: "collectBets" }),
  always({ type: "postBlind" }),
  always({ type: "burnCard", card: "??" }),
  always({ type: "dealHole", cards: ["??"] }),
  {
    action: { type: "checkOrCall" },
    applies: (hand, actionsLeft) => actionsLeft && canCheck(hand),
  },
  { action: { type: "fold" }, applies: (_hand, actionsLeft) => actionsLeft },
  { action: { type: "show", cards: [] }, applies: inProgress },
  always({ type: "selectRunoutCount", count: null }),
  always({ type: "killHand" }),
  always({ type: "pushChips" }),
  always({ type: "pullChips" }),
];

type Repaired = { readonly action: Action; readonly transition: Transition };

function repair(hand: Hand, actionsLeft: boolean): Repaired | null {
  for (const { action, applies } of repairs) {
    if (!applies(hand, actionsLeft)) continue;
    const transition = act(hand, action);
    if (transition.ok) return { action, transition: transition.value };
  }
  return null;
}

function applyPending(
  hand: Hand,
  pending: Pending
): Result<Transition, Violation> {
  if (pending.action === null) return ok({ hand, events: [] });
  return pending.commentary === null
    ? act(hand, pending.action)
    : act(hand, pending.action, { commentary: pending.commentary });
}

/** pokerkit's `HandHistory.state_actions`. With "cardBurning" automated, a burn
 * it fills in joins the next step instead of being one, as pokerkit does. */
function replaySteps(
  start: Transition,
  pending: readonly Pending[],
  burnsJoinNextStep: boolean
): Result<readonly ReplayStep[], HistoryReplayError> {
  const steps: ReplayStep[] = [{ ...start, action: null }];
  let hand = start.hand;
  let carried: readonly HandEvent[] = [];
  const record = (transition: Transition, action: string | null): void => {
    hand = transition.hand;
    steps.push({
      ...transition,
      events: [...carried, ...transition.events],
      action,
    });
    carried = [];
  };
  const fill = ({ action, transition }: Repaired): void => {
    if (burnsJoinNextStep && action.type === "burnCard") {
      hand = transition.hand;
      carried = [...carried, ...transition.events];
    } else {
      record(transition, null);
    }
  };
  for (const [index, next] of pending.entries()) {
    let refusal: Violation | null = null;
    for (;;) {
      const applied = applyPending(hand, next);
      if (applied.ok) {
        record(applied.value, next.text);
        break;
      }
      refusal ??= applied.error;
      const repaired = repair(hand, true);
      if (repaired === null) {
        return err({
          code: "rejected",
          index,
          action: next.text,
          violation: refusal,
        });
      }
      fill(repaired);
    }
  }
  while (inProgress(hand)) {
    const repaired = repair(hand, false);
    if (repaired === null) break;
    fill(repaired);
  }
  if (carried.length > 0) record({ hand, events: [] }, null);
  return ok(steps);
}

/** Plays a history as pokerkit's `HandHistory` iterates it: its actions, and
 * each step it leaves out that pokerkit fills in, such as burning "??". */
export function replayHistory(
  history: Phh,
  options: ReplayOptions = {}
): Result<HistoryReplay, HistoryReplayError> {
  const scale = options.amountScale ?? 1;
  const automate = options.automate ?? historyAutomation;
  const game = historyGame(history, scale);
  if (!game.ok) return game;
  const stacks = stacksAt("starting_stacks", history.startingStacks, scale);
  if (!stacks.ok) return stacks;
  const pending = pendingActions(history.actions, scale);
  if (!pending.ok) return pending;
  const setup = {
    game: game.value,
    stacks: stacks.value,
    deck: decks[game.value.rules.deck],
    automate: automate.filter((step) => step !== "cardBurning"),
  } satisfies HandSetup;
  const started = startHand(setup);
  if (!started.ok) return err({ code: "setup", error: started.error });
  const steps = replaySteps(
    started.value,
    pending.value,
    automate.includes("cardBurning")
  );
  if (!steps.ok) return steps;
  const final = steps.value.at(-1)?.hand ?? started.value.hand;
  return ok({ setup, steps: steps.value, final });
}
