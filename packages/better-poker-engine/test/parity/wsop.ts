import { expect } from "bun:test";

import type { Card } from "../../src/cards.ts";
import type { EventBody, HandEvent } from "../../src/events.ts";
import type { Hand } from "../../src/hand.ts";
import { stateOf } from "../../src/hand/state.ts";
import {
  formatPhh,
  historyFromHand,
  parsePhh,
  replayHistory,
  type Phh,
} from "../../src/phh.ts";
import { accept, type Move } from "../driver.ts";
import { cards } from "../support.ts";

/** pokerkit's `Card.parse(*rows)`, set as the deck the hand deals from. */
export function deck(...rows: readonly string[]): Card[] {
  return cards(rows.join(" "));
}

/** pokerkit's calls without arguments: cards come from the deck, and a
 * showdown player shows only when they can win. */
export const dealer = {
  postAnte: accept({ type: "postAnte" }),
  collectBets: accept({ type: "collectBets" }),
  postBlind: accept({ type: "postBlind" }),
  dealHole: accept({ type: "dealHole" }),
  burnCard: accept({ type: "burnCard" }),
  dealBoard: accept({ type: "dealBoard" }),
  showOrMuck: accept({ type: "timeout" }),
  killHand: accept({ type: "killHand" }),
  pushChips: accept({ type: "pushChips" }),
  pullChips: accept({ type: "pullChips" }),
} satisfies Record<string, Move>;

export function discard(text: string): Move {
  return accept({ type: "draw", discard: cards(text) });
}

function historyOf(hand: Hand): Phh {
  const history = historyFromHand(hand);
  if (!history.ok) throw new Error(JSON.stringify(history.error));
  return history.value;
}

function finalOf(history: Phh): Hand {
  const replay = replayHistory(history);
  if (!replay.ok) throw new Error(JSON.stringify(replay.error));
  return replay.value.final;
}

function parsed(text: string): Phh {
  const history = parsePhh(text);
  if (!history.ok) throw new Error(JSON.stringify(history.error));
  return history.value;
}

/** The end of each WSOP test: the hand's history replays to the same
 * operations, as pokerkit compares them, except the `ignored` kinds. */
export function replaysWithout(
  hand: Hand,
  ignored: readonly EventBody["type"][]
): void {
  const operations = (events: readonly HandEvent[]) =>
    events.flatMap(({ body, commentary }) =>
      ignored.includes(body.type) ? [] : [{ body, commentary }]
    );
  const hh = historyOf(hand);
  let newState = finalOf(hh);

  expect(operations(stateOf(newState).events)).toEqual(
    operations(stateOf(hand).events)
  );

  const newHh = parsed(formatPhh(hh));
  // pokerkit replays `hh` here again, which repeats the check above.
  newState = finalOf(newHh);

  expect(operations(stateOf(newState).events)).toEqual(
    operations(stateOf(hand).events)
  );
  expect(formatPhh(hh)).toBe(formatPhh(newHh));
}
