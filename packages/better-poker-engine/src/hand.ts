import type { Opaque } from "./brand.ts";
import type { Card, Deck } from "./cards.ts";
import type { Chips, Stack, Unbounded } from "./chips.ts";
import type { HandEvent, HandRecord } from "./events.ts";
import { apply, automate, settle } from "./hand/flow.ts";
import { summarize } from "./hand/record.ts";
import { initialState, validateSetup } from "./hand/setup.ts";
import { cloneState, handFrom, stateOf } from "./hand/state.ts";
import { err, ok } from "./result.ts";
import type { Result } from "./result.ts";
import type { Face, GameError, Game } from "./rules.ts";

/** Names a player for the whole hand. Defaults to "p1".."pN" in position order, as in PHH. */
export type PlayerId = string;

/** Holds its setup and full history. Read it through `viewHand` and `summarizeHand`. */
export type Hand = Opaque<"Hand">;

export type HoleCard = { readonly card: Card; readonly face: Face };

export type AutomatedStep =
  | "antePosting"
  | "betCollection"
  | "blindPosting"
  | "cardBurning"
  | "holeDealing"
  | "boardDealing"
  | "runoutCountSelection"
  | "holeCardsShowingOrMucking"
  | "handKilling"
  | "chipsPushing"
  | "chipsPulling";

export type Automation = ReadonlyArray<AutomatedStep>;

/** `dealer` leaves runout counts and showdown choices to the players. */
export const automation = {
  all: [
    "antePosting",
    "betCollection",
    "blindPosting",
    "cardBurning",
    "holeDealing",
    "boardDealing",
    "runoutCountSelection",
    "holeCardsShowingOrMucking",
    "handKilling",
    "chipsPushing",
    "chipsPulling",
  ],
  dealer: [
    "antePosting",
    "betCollection",
    "blindPosting",
    "cardBurning",
    "holeDealing",
    "boardDealing",
    "handKilling",
    "chipsPushing",
    "chipsPulling",
  ],
  none: [],
} as const satisfies Readonly<Record<string, Automation>>;

export type HandSetup = {
  readonly game: Game;
  readonly stacks: ReadonlyArray<number | Unbounded>;
  /** In position order. Defaults to "p1".."pN". */
  readonly players?: ReadonlyArray<PlayerId>;
  /** Dealt from the front; shuffle it first with `shuffle`. */
  readonly deck: Deck;
  readonly automate: Automation;
};

export type SetupError =
  | GameError
  /** Fewer than two, or more than the game's deck can deal their first hole cards and
   * every street. A stacked `deck` may hold less; the dealer then names the rest. */
  | { readonly code: "player_count"; readonly players: number }
  | {
      readonly code: "invalid_stack";
      readonly player: PlayerId;
      readonly stack: number;
    }
  | { readonly code: "duplicate_player"; readonly player: PlayerId }
  | {
      readonly code: "player_ids";
      readonly ids: number;
      readonly stacks: number;
    }
  | { readonly code: "duplicate_card"; readonly card: Card };

export type CheckOrCall =
  | { readonly kind: "check" }
  | { readonly kind: "call"; readonly amount: Chips; readonly allIn: boolean };

export type RaiseRange = {
  readonly kind: "bet" | "raise" | "complete";
  readonly min: Chips;
  readonly max: Stack;
};

export type DealerDecision =
  | {
      readonly kind: "dealer";
      readonly step:
        | "antePosting"
        | "blindPosting"
        | "handKilling"
        | "chipsPulling";
      readonly players: ReadonlyArray<PlayerId>;
    }
  | {
      readonly kind: "dealer";
      readonly step: "betCollection" | "cardBurning" | "chipsPushing";
    }
  | {
      readonly kind: "dealer";
      readonly step: "holeDealing";
      readonly player: PlayerId;
      readonly cards: number;
    }
  | {
      readonly kind: "dealer";
      readonly step: "boardDealing";
      readonly board: number;
      readonly cards: number;
    };

export type Decision =
  | {
      readonly kind: "betting";
      readonly player: PlayerId;
      /** "needless": a free check exists (cash games allow it); null: not allowed. */
      readonly fold: "standard" | "needless" | null;
      /** Null while a bring-in is owed. */
      readonly checkOrCall: CheckOrCall | null;
      readonly betOrRaiseTo: RaiseRange | null;
      readonly bringIn: Chips | null;
    }
  | {
      readonly kind: "drawing";
      readonly player: PlayerId;
      readonly maxDiscards: number;
    }
  | {
      readonly kind: "runoutSelection";
      readonly players: ReadonlyArray<PlayerId>;
      /** The most runouts the deck left can deal in full. */
      readonly maxRunouts: number;
    }
  | {
      readonly kind: "showdown";
      readonly player: PlayerId;
      /** False while this player alone contests a pot that mucking would strand. */
      readonly mayMuck: boolean;
    }
  | DealerDecision
  | { readonly kind: "complete" };

/** Omitted: the next player in order, as in pokerkit. Given: any player eligible for this action. */
type By = { readonly player?: PlayerId };

export type PlayerAction = By &
  (
    | { readonly type: "fold" }
    | { readonly type: "checkOrCall" }
    | { readonly type: "postBringIn" }
    | { readonly type: "betOrRaiseTo"; readonly amount: number }
    | { readonly type: "draw"; readonly discard: ReadonlyArray<Card> }
    | { readonly type: "selectRunoutCount"; readonly count: number | null }
    /** Without cards, shows what is held; with cards, reveals unknown "??" cards or a subset. */
    | { readonly type: "show"; readonly cards?: ReadonlyArray<Card> }
    | { readonly type: "muck" }
    /** Check when free, else fold; stand pat; no runout preference; show only if it can win. */
    | { readonly type: "timeout" }
  );

export type DealerAction =
  | (By & { readonly type: "postAnte" })
  | { readonly type: "collectBets" }
  | (By & { readonly type: "postBlind" })
  | { readonly type: "burnCard"; readonly card?: Card }
  | (By & { readonly type: "dealHole"; readonly cards?: ReadonlyArray<Card> })
  | { readonly type: "dealBoard"; readonly cards?: ReadonlyArray<Card> }
  | (By & { readonly type: "killHand" })
  | { readonly type: "pushChips" }
  | (By & { readonly type: "pullChips" });

export type Action = PlayerAction | DealerAction;

export type Violation =
  /** The action was decided against an earlier version of the hand. */
  | {
      readonly code: "stale_version";
      readonly expected: number;
      readonly current: number;
    }
  | {
      readonly code: "not_now";
      readonly attempted: Action["type"];
      readonly waitingFor: Decision["kind"];
    }
  | {
      readonly code: "not_eligible";
      readonly player: PlayerId;
      readonly eligible: ReadonlyArray<PlayerId>;
    }
  /** Showing outside the showdown requires a named player. */
  | { readonly code: "player_required" }
  | { readonly code: "unknown_player"; readonly player: PlayerId }
  | { readonly code: "invalid_amount"; readonly attempted: number }
  | {
      readonly code: "below_minimum";
      readonly attempted: number;
      readonly minimum: Chips;
    }
  | {
      readonly code: "above_maximum";
      readonly attempted: number;
      readonly maximum: Chips;
    }
  | { readonly code: "betting_capped"; readonly limit: number }
  | { readonly code: "action_not_reopened" }
  | { readonly code: "everyone_else_all_in" }
  /** Calling already puts the player all-in. */
  | { readonly code: "call_is_all_in" }
  | { readonly code: "bring_in_pending" }
  | { readonly code: "needless_fold" }
  | {
      readonly code: "wrong_card_count";
      readonly expected: number;
      readonly attempted: number;
    }
  | {
      readonly code: "not_enough_cards";
      readonly needed: number;
      readonly available: number;
    }
  | { readonly code: "card_not_held"; readonly card: Card }
  | { readonly code: "unknown_card_shown" }
  | {
      readonly code: "runout_count_out_of_range";
      readonly attempted: number;
      readonly maximum: number;
    }
  | { readonly code: "must_show" };

export type Transition = {
  readonly hand: Hand;
  readonly events: ReadonlyArray<HandEvent>;
};

export function startHand(setup: HandSetup): Result<Transition, SetupError> {
  const error = validateSetup(setup);
  if (error !== null) {
    return err(error);
  }
  const state = initialState(setup);
  const events: Array<HandEvent> = [];
  settle(state);
  automate(state, events);
  return ok({ hand: handFrom(state), events });
}

function copyAction(action: Action): Action {
  switch (action.type) {
    case "draw":
      return { ...action, discard: [...action.discard] };
    case "show":
    case "dealHole":
    case "dealBoard":
      return action.cards === undefined
        ? { ...action }
        : { ...action, cards: [...action.cards] };
    default:
      return { ...action };
  }
}

export type ActOptions = {
  readonly commentary?: string;
  /** The `version` the actor saw; any other version refuses the action. */
  readonly expectedVersion?: number;
};

export function act(
  hand: Hand,
  action: Action,
  options: ActOptions = {}
): Result<Transition, Violation> {
  const current = stateOf(hand);
  const { expectedVersion } = options;
  if (expectedVersion !== undefined && expectedVersion !== current.version) {
    return err({
      code: "stale_version",
      expected: expectedVersion,
      current: current.version,
    });
  }
  const state = cloneState(current);
  const copied = copyAction(action);
  const commentary = options.commentary ?? null;
  const events = apply(state, copied, commentary);
  if (!events.ok) {
    return events;
  }
  state.log = [...current.log, { action: copied, commentary }];
  return ok({ hand: handFrom(state), events: events.value });
}

export type ActAsOptions = {
  /** The `version` of the view the player decided on. */
  readonly expectedVersion: number;
  readonly commentary?: string;
};

/** For servers: `player` is who you authenticated and replaces `action.player`, and
 * dealer steps don't type-check, so a client can never deal or act for another seat. */
export function actAs(
  hand: Hand,
  player: PlayerId,
  action: PlayerAction,
  options: ActAsOptions
): Result<Transition, Violation> {
  return act(hand, { ...action, player }, options);
}

/** Null until the hand is complete. Auditor data: it holds every hole card. */
export function summarizeHand(hand: Hand): HandRecord | null {
  const state = stateOf(hand);
  if (state.phase.kind !== "complete") {
    return null;
  }
  return summarize(state, eventsOf(hand));
}

/** Every event so far, replayed from the setup and the actions the hand logged. */
export function eventsOf(hand: Hand): Array<HandEvent> {
  const state = stateOf(hand);
  const started = startHand({
    game: state.game,
    players: state.players,
    stacks: state.startingStacks,
    deck: state.startingDeck,
    automate: state.automate,
  });
  if (!started.ok) {
    throw new Error("A hand no longer starts from its setup");
  }
  let replayed = started.value.hand;
  const events = [...started.value.events];
  for (const { action, commentary } of state.log) {
    const next = act(
      replayed,
      action,
      commentary === null ? {} : { commentary }
    );
    if (!next.ok) {
      throw new Error("A hand no longer replays its own log");
    }
    replayed = next.value.hand;
    events.push(...next.value.events);
  }
  return events;
}

export type ReplayError =
  | { readonly code: "setup"; readonly error: SetupError }
  | {
      readonly code: "rejected";
      readonly index: number;
      readonly violation: Violation;
    };

export function replayHand(
  setup: HandSetup,
  actions: ReadonlyArray<Action>
): Result<Transition, ReplayError> {
  const started = startHand(setup);
  if (!started.ok) {
    return err({ code: "setup", error: started.error });
  }
  let { hand } = started.value;
  const events = [...started.value.events];
  for (const [index, action] of actions.entries()) {
    const next = act(hand, action);
    if (!next.ok) {
      return err({ code: "rejected", index, violation: next.error });
    }
    hand = next.value.hand;
    events.push(...next.value.events);
  }
  return ok({ hand, events });
}
