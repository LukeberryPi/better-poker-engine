import { randomBelow, type RandomSource } from "./random.ts";
import { err, ok, type Result } from "./result.ts";
import { isWhitespace } from "./words.ts";

const ranks = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
] as const;
export const suits = ["c", "d", "h", "s"] as const;

/** pokerkit's `Rank` and `Suit` members: `?` marks an unknown rank or suit. */
export const rankSymbols = [...ranks, "?"] as const;
export const suitSymbols = [...suits, "?"] as const;

export type Rank = (typeof ranks)[number];
export type Suit = (typeof suits)[number];
export type RankSymbol = (typeof rankSymbols)[number];
export type SuitSymbol = (typeof suitSymbols)[number];

export type KnownCard = `${Rank}${Suit}`;
/** A card whose rank is known but whose suit is not, e.g. `J?`. */
export type PartlyKnownCard = `${Rank}?`;
/** A card whose identity is not known, e.g. an unshown hole card in a history. */
export type UnknownCard = "??";
export type Card = KnownCard | PartlyKnownCard | UnknownCard;

/** Dealing order: the first card is dealt first. */
export type Deck = readonly Card[];

export function cardOf(rank: Rank, suit: Suit): KnownCard {
  return `${rank}${suit}`;
}

export function rankOf(card: Card): RankSymbol {
  // SAFETY: every card is a rank symbol followed by a suit symbol.
  return card.charAt(0) as RankSymbol;
}

export function suitOf(card: Card): SuitSymbol {
  // SAFETY: every card is a rank symbol followed by a suit symbol.
  return card.charAt(1) as SuitSymbol;
}

export function isKnownCard(card: Card): card is KnownCard {
  return !card.endsWith("?");
}

export function arePaired(cards: readonly Card[]): boolean {
  return new Set(cards.map(rankOf)).size !== cards.length;
}

export function areSuited(cards: readonly Card[]): boolean {
  const [first] = cards;
  return (
    first === undefined || cards.every((card) => suitOf(card) === suitOf(first))
  );
}

export function areRainbow(cards: readonly Card[]): boolean {
  return new Set(cards.map(suitOf)).size === cards.length;
}

export function parseRank(symbol: string): RankSymbol | null {
  return rankSymbols.find((rank) => rank === symbol) ?? null;
}

export function parseSuit(symbol: string): SuitSymbol | null {
  return suitSymbols.find((suit) => suit === symbol) ?? null;
}

function cardFrom(rankText: string, suitText: string): Card | null {
  const rank = parseRank(rankText);
  const suit = parseSuit(suitText);
  if (rank === null || suit === null) return null;
  if (rank === "?") return suit === "?" ? "??" : null;
  return suit === "?" ? `${rank}?` : cardOf(rank, suit);
}

/** `at` is the offset of the invalid card in the parsed text, `text` the card as written. */
export type CardParseError = {
  readonly code: "invalid_card";
  readonly at: number;
  readonly text: string;
};

/** Reads cards as pokerkit does: `10` means `T`, commas are ignored, whitespace separates. */
export function parseCards(
  text: string
): Result<readonly Card[], CardParseError> {
  const cards: Card[] = [];
  let rank: { readonly text: string; readonly at: number } | null = null;
  for (const token of text.matchAll(/10|./gsu)) {
    const symbol = token[0] === "10" ? "T" : token[0];
    if (symbol === ",") continue;
    if (isWhitespace(symbol)) {
      if (rank !== null) return invalidCard(text, rank.at, token.index);
    } else if (rank === null) {
      rank = { text: symbol, at: token.index };
    } else {
      const card = cardFrom(rank.text, symbol);
      const end = token.index + token[0].length;
      if (card === null) return invalidCard(text, rank.at, end);
      cards.push(card);
      rank = null;
    }
  }
  return rank === null ? ok(cards) : invalidCard(text, rank.at, text.length);
}

function invalidCard(
  text: string,
  at: number,
  end: number
): Result<never, CardParseError> {
  return err({ code: "invalid_card", at, text: text.slice(at, end) });
}

export const rankNames = {
  A: "ACE",
  "2": "DEUCE",
  "3": "TREY",
  "4": "FOUR",
  "5": "FIVE",
  "6": "SIX",
  "7": "SEVEN",
  "8": "EIGHT",
  "9": "NINE",
  T: "TEN",
  J: "JACK",
  Q: "QUEEN",
  K: "KING",
  "?": "UNKNOWN",
} as const satisfies Record<RankSymbol, string>;

export const suitNames = {
  c: "CLUB",
  d: "DIAMOND",
  h: "HEART",
  s: "SPADE",
  "?": "UNKNOWN",
} as const satisfies Record<SuitSymbol, string>;

/** pokerkit's `str(card)`, e.g. `ACE OF SPADES (As)`. */
export function describeCard(card: Card): string {
  return `${rankNames[rankOf(card)]} OF ${suitNames[suitOf(card)]}S (${card})`;
}

/** Ranks from lowest to highest, as pokerkit's `RankOrder`. */
export const rankOrders = {
  standard: ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"],
  shortDeck: ["6", "7", "8", "9", "T", "J", "Q", "K", "A"],
  regular: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"],
  eightOrBetter: ["A", "2", "3", "4", "5", "6", "7", "8"],
  kuhn: ["J", "Q", "K"],
  numeral211: ["2", "3", "4", "5", "6", "7", "8", "9", "T", "A"],
  royal: ["T", "J", "Q", "K", "A"],
} as const satisfies Record<string, readonly Rank[]>;

export type DeckName =
  | "standard"
  | "shortDeck"
  | "regular"
  | "kuhn"
  | "leduc"
  | "numeral211"
  | "royal";

function deckOf(
  rankOrder: readonly Rank[],
  deckSuits: readonly Suit[]
): readonly KnownCard[] {
  return Object.freeze(
    rankOrder.flatMap((rank) => deckSuits.map((suit) => cardOf(rank, suit)))
  );
}

/** pokerkit's decks, in its order: ranks by rank order, then clubs to spades. */
export const decks = Object.freeze({
  standard: deckOf(rankOrders.standard, suits),
  shortDeck: deckOf(rankOrders.shortDeck, suits),
  regular: deckOf(rankOrders.regular, suits),
  kuhn: deckOf(rankOrders.kuhn, ["s"]),
  leduc: deckOf(rankOrders.kuhn, ["h", "s"]),
  numeral211: deckOf(rankOrders.numeral211, suits),
  royal: deckOf(rankOrders.royal, suits),
} satisfies Record<DeckName, readonly KnownCard[]>);

/** A uniformly random permutation, drawn by Fisher-Yates. */
export function shuffle(
  cards: readonly KnownCard[],
  random: RandomSource
): readonly KnownCard[] {
  const remaining = [...cards];
  const shuffled: KnownCard[] = [];
  while (remaining.length > 0) {
    shuffled.push(
      ...remaining.splice(randomBelow(remaining.length, random), 1)
    );
  }
  return shuffled;
}
