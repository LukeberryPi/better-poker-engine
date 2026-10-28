import { parseCards, type Card } from "./cards.ts";
import { canonicalDecimal, type PhhDecimal } from "./phh-amounts.ts";
import { wordsOf } from "./words.ts";

type Cards = readonly [Card, ...Card[]];

type ActionBody =
  | {
      readonly type: "dealHole";
      readonly player: number;
      readonly cards: Cards;
    }
  | { readonly type: "dealBoard"; readonly cards: Cards }
  | {
      readonly type: "draw";
      readonly player: number;
      readonly discard: readonly Card[];
    }
  | { readonly type: "postBringIn"; readonly player: number }
  | { readonly type: "fold"; readonly player: number }
  | { readonly type: "checkOrCall"; readonly player: number }
  | {
      readonly type: "betOrRaiseTo";
      readonly player: number;
      readonly amount: PhhDecimal;
    }
  | {
      readonly type: "show";
      readonly player: number;
      readonly cards: Cards | null;
    }
  | { readonly type: "muck"; readonly player: number }
  | { readonly type: "noOp" };

/** One entry of `actions`: `player` is the N of `pN`, an empty `discard` stands pat,
 * and `show` has `cards: null` for `sm -`. `p1 f # tilt` has commentary `tilt`. */
export type PhhAction = ActionBody & { readonly commentary: string | null };

function playerOf(label: string): number | null {
  const player = Number(/^p([1-9]\d*)$/u.exec(label)?.[1]);
  return Number.isSafeInteger(player) ? player : null;
}

function cardsOf(text: string): Cards | null {
  const parsed = parseCards(text);
  if (!parsed.ok) return null;
  const [first, ...rest] = parsed.value;
  return first === undefined ? null : [first, ...rest];
}

/** Reads a `cbr` amount, pokerkit's `parse_value`: a positive decimal such as
 * `7000` or `0.25`, written without a sign, exponent or digit separators. */
export function parseAmount(text: string): PhhDecimal | null {
  if (!/^\d+(?:\.\d+)?$/u.test(text)) return null;
  const amount = canonicalDecimal(text);
  return amount === "0" ? null : amount;
}

function dealing(words: readonly string[]): ActionBody | null {
  const [code, first, second, ...rest] = words;
  if (first === undefined || rest.length > 0) return null;
  if (code === "db" && second === undefined) {
    const cards = cardsOf(first);
    return cards === null ? null : { type: "dealBoard", cards };
  }
  if (code !== "dh" || second === undefined) return null;
  const player = playerOf(first);
  const cards = cardsOf(second);
  return player === null || cards === null
    ? null
    : { type: "dealHole", player, cards };
}

function bare(player: number, code: string): ActionBody | null {
  switch (code) {
    case "f":
      return { type: "fold", player };
    case "cc":
      return { type: "checkOrCall", player };
    case "pb":
      return { type: "postBringIn", player };
    case "sd":
      return { type: "draw", player, discard: [] };
    case "sm":
      return { type: "muck", player };
    default:
      return null;
  }
}

function withArgument(
  player: number,
  code: string,
  argument: string
): ActionBody | null {
  if (code === "cbr") {
    const amount = parseAmount(argument);
    return amount === null ? null : { type: "betOrRaiseTo", player, amount };
  }
  if (code === "sm" && argument === "-") {
    return { type: "show", player, cards: null };
  }
  const cards = cardsOf(argument);
  if (cards === null) return null;
  if (code === "sd") return { type: "draw", player, discard: cards };
  return code === "sm" ? { type: "show", player, cards } : null;
}

function bodyOf(words: readonly string[]): ActionBody | null {
  const [actor, code, argument, ...rest] = words;
  if (actor === undefined) return { type: "noOp" };
  if (actor === "d") return dealing(words.slice(1));
  const player = playerOf(actor);
  if (player === null || code === undefined || rest.length > 0) return null;
  return argument === undefined
    ? bare(player, code)
    : withArgument(player, code, argument);
}

/** Reads one action as pokerkit does: its words up to a standalone `#`, and as
 * commentary the text after the first `#` and one more character. */
export function parsePhhAction(text: string): PhhAction | null {
  const words = wordsOf(text).map((word) => word.text);
  const hash = words.indexOf("#");
  const body = bodyOf(hash === -1 ? words : words.slice(0, hash));
  if (body === null) return null;
  const at = text.indexOf("#");
  return { ...body, commentary: at === -1 ? null : text.slice(at + 2) };
}

function bodyText(action: PhhAction): string {
  switch (action.type) {
    case "dealHole":
      return `d dh p${action.player} ${action.cards.join("")}`;
    case "dealBoard":
      return `d db ${action.cards.join("")}`;
    case "draw":
      return action.discard.length === 0
        ? `p${action.player} sd`
        : `p${action.player} sd ${action.discard.join("")}`;
    case "postBringIn":
      return `p${action.player} pb`;
    case "fold":
      return `p${action.player} f`;
    case "checkOrCall":
      return `p${action.player} cc`;
    case "betOrRaiseTo":
      return `p${action.player} cbr ${canonicalDecimal(action.amount) ?? action.amount}`;
    case "show":
      return `p${action.player} sm ${action.cards?.join("") ?? "-"}`;
    case "muck":
      return `p${action.player} sm`;
    case "noOp":
      return "";
  }
}

/** Writes an action the way pokerkit's `HandHistory.from_game_state` does. */
export function formatPhhAction(action: PhhAction): string {
  const body = bodyText(action);
  if (action.commentary === null) return body;
  const hash = body === "" ? "#" : `${body} #`;
  return action.commentary === "" ? hash : `${hash} ${action.commentary}`;
}
