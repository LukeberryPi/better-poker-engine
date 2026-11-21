import type { DeckName } from "./cards.ts";
import { isChips, type Chips } from "./chips.ts";
import type { HandType } from "./evaluation.ts";
import type { VariantCode } from "./variants.ts";

export type NonEmpty<T> = readonly [T, ...Array<T>];

export type Face = "up" | "down";

export type BettingStructure = "fixedLimit" | "potLimit" | "noLimit";

/** Who acts first on a street: by seat, or by the up cards on show. */
export type Opening =
  | "position"
  | "lowCard"
  | "highCard"
  | "lowHand"
  | "highHand";

export type Street = {
  readonly burn: boolean;
  /** One entry per hole card each player receives on this street. */
  readonly hole: ReadonlyArray<Face>;
  readonly board: number;
  readonly draw: boolean;
  readonly opening: Opening;
  readonly minCompletionBetOrRaise: Chips;
  /** Null means uncapped. */
  readonly maxBetsAndRaises: number | null;
};

export type Rules = {
  readonly deck: DeckName;
  /** Each pot is split evenly between hand types, as hi/lo games do. */
  readonly handTypes: NonEmpty<HandType>;
  readonly streets: NonEmpty<Street>;
  readonly structure: BettingStructure;
};

export type Antes =
  | { readonly kind: "none" }
  | { readonly kind: "everyone"; readonly amount: Chips }
  | { readonly kind: "button"; readonly amount: Chips }
  | { readonly kind: "bigBlind"; readonly amount: Chips }
  | { readonly kind: "byPosition"; readonly amounts: ReadonlyArray<Chips> };

export type ForcedBets = {
  readonly antes: Antes;
  /** By position: small blind, big blind, then straddles. Negative amounts post a bet. */
  readonly blinds: ReadonlyArray<number>;
  readonly bringIn: Chips | null;
  /** Return the part of each ante nobody else matched before the first street. */
  readonly anteTrimming: boolean;
};

export type Rake =
  | { readonly kind: "none" }
  | {
      readonly kind: "percentage";
      /** Hundredths of a percent; the raked amount rounds half to even. */
      readonly basisPoints: number;
      readonly cap: RakeCap | null;
      readonly noFlopNoDrop: boolean;
    };

export type RakeCap = {
  readonly amount: Chips;
  /** "pot" is pokerkit: each pot is capped alone. "hand" caps the hand, main pot first. */
  readonly per: "pot" | "hand";
};

/** pokerkit's modes, which name the presets `conventions.tournament` and `.cashGame`. */
export type Mode = "tournament" | "cashGame";

/** Rules that pokerkit and card rooms settle differently. `conventions` holds presets. */
export type Conventions = {
  /** Folding when a check is free. */
  readonly needlessFolds: "allowed" | "refused";
  /** Who decides how many times an all-in board runs out. */
  readonly runouts: "playersChoose" | "once";
  /** Whether a show may keep some hole cards down. */
  readonly partialShows: "allowed" | "refused";
  /** "unclaimed" is pokerkit, which hand histories need: a fold or muck may leave a pot
   * nobody can win. "refused" refuses those actions, so every chip finds a winner. */
  readonly strandedPots: "refused" | "unclaimed";
  /** TDA Rule 47: the big blind is a full bet, and a short all-in reopens betting only for
   * a player who has not acted, or who now faces a full raise since acting. */
  readonly bigBlindIsFullBet: boolean;
  /** Preflop, calls and raises are priced from the largest blind even when it posted short. */
  readonly nominalBigBlind: boolean;
  /** What a stack too short for both posts first. */
  readonly antePrecedence: "ante" | "blind";
  /** Odd chips of a split: all to the first share, or one each from the first on. */
  readonly oddChips: "firstShare" | "oneEach";
};

const tournament = {
  needlessFolds: "refused",
  runouts: "once",
  partialShows: "refused",
  strandedPots: "refused",
  bigBlindIsFullBet: false,
  nominalBigBlind: false,
  antePrecedence: "ante",
  oddChips: "firstShare",
} as const satisfies Conventions;

/** pokerkit's two modes, except that pots are never stranded, and the 2024 TDA rules
 * card rooms play: https://www.pokertda.com/view-poker-tda-rules/ */
export const conventions = {
  tournament,
  cashGame: {
    ...tournament,
    needlessFolds: "allowed",
    runouts: "playersChoose",
    partialShows: "allowed",
  },
  tda2024: {
    ...tournament,
    bigBlindIsFullBet: true,
    nominalBigBlind: true,
    antePrecedence: "blind",
    oddChips: "oneEach",
  },
} as const satisfies Readonly<Record<string, Conventions>>;

/** Plain configuration; `startHand` validates it. */
export type Game = {
  readonly variant: VariantCode | "custom";
  readonly rules: Rules;
  readonly forcedBets: ForcedBets;
  readonly rake: Rake;
  readonly conventions: Conventions;
  /** Boards dealt from the first street, e.g. 2 for double-board games. */
  readonly boards: number;
};

export type GameError =
  | {
      readonly code: "invalid_amount";
      readonly field: string;
      readonly value: number;
    }
  | { readonly code: "street_deals_nothing"; readonly street: number }
  | { readonly code: "hole_cards_with_draw"; readonly street: number }
  | { readonly code: "first_street_without_hole_cards" }
  | { readonly code: "no_forced_bets" }
  | { readonly code: "blinds_with_bring_in" }
  | {
      readonly code: "bring_in_not_below_min_bet";
      readonly bringIn: Chips;
      readonly minBet: Chips;
    };

/** A preset by its mode, or every convention spelled out; the default is "tournament". */
type ConventionOptions =
  | { readonly mode?: Mode; readonly conventions?: never }
  | { readonly mode?: never; readonly conventions: Conventions };

type Options = ConventionOptions & {
  readonly antes?: Antes;
  readonly rake?: Rake;
  readonly anteTrimming?: boolean;
  readonly boards?: number;
};

export type BlindStakes = Options & {
  readonly blinds: ReadonlyArray<number>;
  readonly minBet: Chips;
};

export type FixedLimitStakes = Options & {
  readonly blinds: ReadonlyArray<number>;
  readonly smallBet: Chips;
  readonly bigBet: Chips;
};

export type StudStakes = Options & {
  readonly bringIn?: Chips;
  readonly smallBet: Chips;
  readonly bigBet: Chips;
};

export type KuhnStakes = Options & { readonly bet?: Chips };

export type AnteStakes = Options & {
  readonly smallBet?: Chips;
  readonly bigBet?: Chips;
};

type Builder<Stakes> = (stakes: Stakes) => Game;

type Bets = { readonly small: Chips; readonly big: Chips };

const fixedLimitCap = 4;

function streetOf(
  structure: BettingStructure,
  dealt: Pick<Street, "burn" | "hole" | "board" | "draw" | "opening">,
  bet: Chips
): Street {
  return {
    ...dealt,
    minCompletionBetOrRaise: bet,
    maxBetsAndRaises: structure === "fixedLimit" ? fixedLimitCap : null,
  };
}

function down(count: number): Array<Face> {
  return Array.from({ length: count }, () => "down");
}

function boardRules(
  deck: DeckName,
  handTypes: NonEmpty<HandType>,
  hole: number,
  structure: BettingStructure
): (bets: Bets) => Rules {
  const street = (burn: boolean, cards: number, board: number, bet: Chips) =>
    streetOf(
      structure,
      { burn, hole: down(cards), board, draw: false, opening: "position" },
      bet
    );
  return (bets) => ({
    deck,
    handTypes,
    streets: [
      street(false, hole, 0, bets.small),
      street(true, 0, 3, bets.small),
      street(true, 0, 1, bets.big),
      street(true, 0, 1, bets.big),
    ],
    structure,
  });
}

function drawRules(
  deck: DeckName,
  handTypes: NonEmpty<HandType>,
  hole: number,
  draws: number,
  structure: BettingStructure
): (bets: Bets) => Rules {
  return (bets) => ({
    deck,
    handTypes,
    streets: [
      streetOf(
        structure,
        {
          burn: false,
          hole: down(hole),
          board: 0,
          draw: false,
          opening: "position",
        },
        bets.small
      ),
      ...Array.from({ length: draws }, (_, index) =>
        streetOf(
          structure,
          { burn: true, hole: [], board: 0, draw: true, opening: "position" },
          index === 0 ? bets.small : bets.big
        )
      ),
    ],
    structure,
  });
}

function studRules(
  deck: DeckName,
  handTypes: NonEmpty<HandType>,
  low: boolean
): (bets: Bets) => Rules {
  const later = low ? "lowHand" : "highHand";
  const street = (hole: ReadonlyArray<Face>, bet: Chips) =>
    streetOf(
      "fixedLimit",
      { burn: true, hole, board: 0, draw: false, opening: later },
      bet
    );
  return (bets) => ({
    deck,
    handTypes,
    streets: [
      streetOf(
        "fixedLimit",
        {
          burn: false,
          hole: ["down", "down", "up"],
          board: 0,
          draw: false,
          opening: low ? "highCard" : "lowCard",
        },
        bets.small
      ),
      street(["up"], bets.small),
      street(["up"], bets.big),
      street(["up"], bets.big),
      street(["down"], bets.big),
    ],
    structure: "fixedLimit",
  });
}

function betsOf(stakes: BlindStakes | FixedLimitStakes | StudStakes): Bets {
  return "minBet" in stakes
    ? { small: stakes.minBet, big: stakes.minBet }
    : { small: stakes.smallBet, big: stakes.bigBet };
}

function gameOf(
  variant: Game["variant"],
  rules: Rules,
  forcedBets: Pick<ForcedBets, "blinds" | "bringIn">,
  options: Options
): Game {
  return {
    variant,
    rules,
    forcedBets: {
      antes: options.antes ?? { kind: "none" },
      ...forcedBets,
      anteTrimming: options.anteTrimming ?? false,
    },
    rake: options.rake ?? { kind: "none" },
    conventions:
      options.conventions ?? conventions[options.mode ?? "tournament"],
    boards: options.boards ?? 1,
  };
}

function blindGame<Stakes extends BlindStakes | FixedLimitStakes>(
  variant: Game["variant"],
  rules: (bets: Bets) => Rules
): Builder<Stakes> {
  return (stakes) =>
    gameOf(
      variant,
      rules(betsOf(stakes)),
      { blinds: stakes.blinds, bringIn: null },
      stakes
    );
}

function studGame(
  variant: VariantCode,
  rules: (bets: Bets) => Rules
): Builder<StudStakes> {
  return (stakes) =>
    gameOf(
      variant,
      rules(betsOf(stakes)),
      { blinds: [], bringIn: stakes.bringIn ?? null },
      stakes
    );
}

/** One hole card, then one board card a street; antes are the only forced bets. */
type OneCardGame = {
  readonly deck: DeckName;
  readonly handType: HandType;
  readonly boardStreets: number;
  readonly maxBetsAndRaises: number;
};

function oneCardGame(
  game: OneCardGame,
  ante: Chips,
  bets: Bets,
  options: Options
): Game {
  const street = (board: number, bet: Chips): Street => ({
    burn: board > 0,
    hole: board > 0 ? [] : ["down"],
    board,
    draw: false,
    opening: "position",
    minCompletionBetOrRaise: bet,
    maxBetsAndRaises: game.maxBetsAndRaises,
  });
  const rules: Rules = {
    deck: game.deck,
    handTypes: [game.handType],
    streets: [
      street(0, bets.small),
      ...Array.from({ length: game.boardStreets }, () => street(1, bets.big)),
    ],
    structure: "fixedLimit",
  };
  return gameOf(
    "custom",
    rules,
    { blinds: [], bringIn: null },
    {
      ...options,
      antes: options.antes ?? { kind: "everyone", amount: ante },
      anteTrimming: options.anteTrimming ?? true,
    }
  );
}

function anteGame(
  game: OneCardGame,
  ante: Chips,
  bets: Bets
): (stakes?: AnteStakes) => Game {
  return (stakes = {}) =>
    oneCardGame(
      game,
      ante,
      { small: stakes.smallBet ?? bets.small, big: stakes.bigBet ?? bets.big },
      stakes
    );
}

export const holdem = {
  fixedLimit: blindGame<FixedLimitStakes>(
    "FT",
    boardRules("standard", ["standardHigh"], 2, "fixedLimit")
  ),
  noLimit: blindGame<BlindStakes>(
    "NT",
    boardRules("standard", ["standardHigh"], 2, "noLimit")
  ),
};

export const shortDeck = {
  noLimit: blindGame<BlindStakes>(
    "NS",
    boardRules("shortDeck", ["shortDeckHigh"], 2, "noLimit")
  ),
};

export const omaha = {
  potLimit: blindGame<BlindStakes>(
    "PO",
    boardRules("standard", ["omahaHigh"], 4, "potLimit")
  ),
  /** pokerkit builds this game pot-limit; it is fixed-limit here, as named. */
  fixedLimitHiLo: blindGame<FixedLimitStakes>(
    "FO/8",
    boardRules(
      "standard",
      ["omahaHigh", "omahaEightOrBetterLow"],
      4,
      "fixedLimit"
    )
  ),
};

export const stud = {
  fixedLimit: studGame("F7S", studRules("standard", ["standardHigh"], false)),
  fixedLimitHiLo: studGame(
    "F7S/8",
    studRules("standard", ["standardHigh", "eightOrBetterLow"], false)
  ),
  razz: studGame("FR", studRules("regular", ["regularLow"], true)),
};

export const draw = {
  deuceToSevenSingle: blindGame<BlindStakes>(
    "N2L1D",
    drawRules("standard", ["standardLow"], 5, 1, "noLimit")
  ),
  deuceToSevenTriple: blindGame<FixedLimitStakes>(
    "F2L3D",
    drawRules("standard", ["standardLow"], 5, 3, "fixedLimit")
  ),
  badugi: blindGame<FixedLimitStakes>(
    "FB",
    drawRules("regular", ["badugi"], 4, 3, "fixedLimit")
  ),
};

export const kuhn = {
  /** Antes 1 and a bet of 1 unless given, antes trimmed, as in pokerkit. */
  fixedLimit: (stakes: KuhnStakes = {}): Game => {
    const bet = stakes.bet ?? 1;
    return oneCardGame(
      { deck: "kuhn", handType: "kuhn", boardStreets: 0, maxBetsAndRaises: 1 },
      1,
      { small: bet, big: bet },
      stakes
    );
  },
};

export const leduc = {
  /** Antes 1 and bets 2 then 4 unless given, antes trimmed, as in pokerkit. */
  fixedLimit: anteGame(
    { deck: "leduc", handType: "leduc", boardStreets: 1, maxBetsAndRaises: 2 },
    1,
    { small: 2, big: 4 }
  ),
};

const rhodeIslandBets = { small: 10, big: 20 };

function rhodeIslandGame(deck: DeckName): (stakes?: AnteStakes) => Game {
  return anteGame(
    { deck, handType: "rhodeIsland", boardStreets: 2, maxBetsAndRaises: 3 },
    5,
    rhodeIslandBets
  );
}

export const rhodeIsland = {
  /** Antes 5 and bets 10 then 20 unless given, antes trimmed, as in pokerkit. */
  fixedLimit: rhodeIslandGame("standard"),
};

export const numeral211 = {
  /** Antes 5 and bets 10 then 20 unless given, antes trimmed, as in pokerkit. */
  fixedLimit: anteGame(
    {
      deck: "numeral211",
      handType: "numeral211",
      boardStreets: 2,
      maxBetsAndRaises: 4,
    },
    5,
    rhodeIslandBets
  ),
};

/** Texas and Rhode Island hold'em dealt from the twenty cards ten to ace. */
export const royal = {
  noLimit: blindGame<BlindStakes>(
    "custom",
    boardRules("royal", ["standardHigh"], 2, "noLimit")
  ),
  rhodeIsland: rhodeIslandGame("royal"),
};

function anteAmounts(antes: Antes): ReadonlyArray<number> {
  switch (antes.kind) {
    case "none":
      return [];
    case "everyone":
    case "button":
    case "bigBlind":
      return [antes.amount];
    case "byPosition":
      return antes.amounts;
  }
}

function invalid(field: string, value: number): GameError {
  return { code: "invalid_amount", field, value };
}

function firstInvalid(
  field: string,
  values: ReadonlyArray<number>,
  valid: (value: number) => boolean
): GameError | null {
  const value = values.find((candidate) => !valid(candidate));
  return value === undefined ? null : invalid(field, value);
}

function streetError(street: Street, index: number): GameError | null {
  const field = `streets.${index}`;
  if (!isChips(street.board)) return invalid(`${field}.board`, street.board);
  const holeCards = street.hole.length > 0;
  if (!holeCards && street.board === 0 && !street.draw) {
    return { code: "street_deals_nothing", street: index };
  }
  if (holeCards && street.draw) {
    return { code: "hole_cards_with_draw", street: index };
  }
  const minBet = street.minCompletionBetOrRaise;
  if (!isChips(minBet) || minBet === 0) {
    return invalid(`${field}.minCompletionBetOrRaise`, minBet);
  }
  if (street.maxBetsAndRaises !== null && !isChips(street.maxBetsAndRaises)) {
    return invalid(`${field}.maxBetsAndRaises`, street.maxBetsAndRaises);
  }
  return null;
}

function rakeError(rake: Rake): GameError | null {
  if (rake.kind === "none") return null;
  if (!isChips(rake.basisPoints) || rake.basisPoints > 10_000) {
    return invalid("rake.basisPoints", rake.basisPoints);
  }
  if (rake.cap !== null && !isChips(rake.cap.amount)) {
    return invalid("rake.cap.amount", rake.cap.amount);
  }
  return null;
}

/** pokerkit's `Street` and `State` checks, in the order pokerkit runs them. */
export function validateGame(game: Game): GameError | null {
  const { streets } = game.rules;
  for (const [index, street] of streets.entries()) {
    const error = streetError(street, index);
    if (error !== null) return error;
  }
  if (streets[0].hole.length === 0) {
    return { code: "first_street_without_hole_cards" };
  }
  const { antes, blinds, bringIn } = game.forcedBets;
  const anteError = firstInvalid(
    "forcedBets.antes",
    anteAmounts(antes),
    isChips
  );
  if (anteError !== null) return anteError;
  const blindError = firstInvalid(
    "forcedBets.blinds",
    blinds,
    Number.isSafeInteger
  );
  if (blindError !== null) return blindError;
  if (bringIn !== null && !isChips(bringIn)) {
    return invalid("forcedBets.bringIn", bringIn);
  }
  const anyAnte = anteAmounts(antes).some((amount) => amount > 0);
  const anyBlind = blinds.some((amount) => amount !== 0);
  const anyBringIn = bringIn !== null && bringIn > 0;
  if (!anyAnte && !anyBlind && !anyBringIn) return { code: "no_forced_bets" };
  if (anyBlind && anyBringIn) return { code: "blinds_with_bring_in" };
  const minBet = streets[0].minCompletionBetOrRaise;
  if (bringIn !== null && bringIn >= minBet) {
    return { code: "bring_in_not_below_min_bet", bringIn, minBet };
  }
  if (!Number.isSafeInteger(game.boards) || game.boards < 1) {
    return invalid("boards", game.boards);
  }
  return rakeError(game.rake);
}
