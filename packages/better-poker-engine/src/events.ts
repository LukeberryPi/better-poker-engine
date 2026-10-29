import type { Card } from "./cards.ts";
import type { Chips, Stack } from "./chips.ts";
import type {
  Action,
  AutomatedStep,
  Decision,
  HoleCard,
  PlayerId,
} from "./hand.ts";
import type { Mode } from "./rules.ts";
import type { VariantCode } from "./variants.ts";
import type { Pot } from "./views.ts";

export type Cause =
  | { readonly kind: "action"; readonly action: Action }
  | { readonly kind: "automation"; readonly step: AutomatedStep };

export type PlayerAmount = {
  readonly player: PlayerId;
  readonly amount: Chips;
};

export type EventBody =
  | {
      readonly type: "antePosted";
      readonly player: PlayerId;
      readonly amount: Chips;
    }
  | {
      readonly type: "betsCollected";
      readonly collected: Chips;
      /** Uncalled parts of bets, back to their owners. */
      readonly returned: readonly PlayerAmount[];
    }
  | {
      readonly type: "blindPosted";
      readonly player: PlayerId;
      readonly amount: Chips;
    }
  | { readonly type: "cardBurned"; readonly card: Card }
  | {
      readonly type: "holeDealt";
      readonly player: PlayerId;
      readonly cards: readonly HoleCard[];
    }
  | {
      readonly type: "boardDealt";
      readonly board: number;
      readonly cards: readonly Card[];
    }
  | {
      readonly type: "drew";
      readonly player: PlayerId;
      readonly discarded: readonly Card[];
    }
  | {
      readonly type: "folded";
      readonly player: PlayerId;
      readonly needless: boolean;
    }
  | { readonly type: "checked"; readonly player: PlayerId }
  | {
      readonly type: "called";
      readonly player: PlayerId;
      readonly amount: Chips;
      readonly allIn: boolean;
    }
  | {
      readonly type: "bringInPosted";
      readonly player: PlayerId;
      readonly amount: Chips;
    }
  | {
      readonly type: "betOrRaised";
      readonly player: PlayerId;
      readonly kind: "bet" | "raise" | "complete";
      readonly to: Chips;
      readonly allIn: boolean;
    }
  | {
      readonly type: "runoutCountSelected";
      readonly player: PlayerId;
      readonly count: number | null;
    }
  | {
      readonly type: "shown";
      readonly player: PlayerId;
      /** "??" pads a partial show. */
      readonly cards: readonly Card[];
    }
  | { readonly type: "mucked"; readonly player: PlayerId }
  | { readonly type: "handKilled"; readonly player: PlayerId }
  | {
      readonly type: "chipsPushed";
      readonly pot: number;
      readonly board: number | null;
      readonly handType: number | null;
      readonly awards: readonly PlayerAmount[];
      /** Chips no eligible player could claim; they stay in the pot. */
      readonly unclaimed: Chips;
    }
  | {
      readonly type: "chipsPulled";
      readonly player: PlayerId;
      readonly amount: Chips;
    };

/** Arrays are in position order. */
export type Snapshot = {
  readonly stacks: readonly Stack[];
  readonly bets: readonly Chips[];
  readonly pots: readonly Pot[];
  readonly waitingFor: Decision["kind"];
};

export type HandEvent = {
  /** Equals the hand's version after this event. */
  readonly seq: number;
  readonly cause: Cause;
  readonly street: number | null;
  readonly body: EventBody;
  readonly after: Snapshot;
  readonly commentary: string | null;
};

export type PlayerRecord = {
  readonly player: PlayerId;
  readonly position: number;
  readonly startingStack: Stack;
  readonly endingStack: Stack;
  /** Chips won less chips put in, known even when a stack is unbounded. */
  readonly net: number;
  /** What the player held last, folded or not; face "up" once shown. */
  readonly holeCards: readonly HoleCard[];
  readonly foldedOnStreet: number | null;
  readonly allInOnStreet: number | null;
};

export type PotRecord = {
  readonly amount: Chips;
  readonly raked: Chips;
  readonly eligible: readonly PlayerId[];
  readonly winners: readonly {
    readonly player: PlayerId;
    readonly amount: Chips;
    /** Null when the pot went uncontested to a winner who didn't show. */
    readonly hand: string | null;
  }[];
};

/** The wide record of one hand. Stores add where and when (session, hand number, times). */
export type HandRecord = {
  readonly engineVersion: string;
  readonly variant: VariantCode | "custom";
  readonly mode: Mode;
  readonly players: readonly PlayerRecord[];
  readonly boards: readonly (readonly Card[])[];
  readonly pots: readonly PotRecord[];
  readonly rake: Chips;
  readonly unclaimed: Chips;
  readonly runouts: number;
  readonly streetsReached: number;
  readonly actions: number;
  readonly wentToShowdown: boolean;
};
