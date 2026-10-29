import { expect } from "bun:test";

import type { Card } from "../../src/cards.ts";
import type { EventBody, HandEvent } from "../../src/events.ts";
import type { Hand } from "../../src/hand.ts";
import { stateOf } from "../../src/hand/state.ts";
import { formatPhh } from "../../src/phh.ts";
import { accept, type Move } from "../driver.ts";
import { exported, parsed, replayed } from "../phh-support.ts";
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
  const hh = exported(hand);
  let newState = replayed(hh).final;

  expect(operations(stateOf(newState).events)).toEqual(
    operations(stateOf(hand).events)
  );

  const newHh = parsed(formatPhh(hh));
  // pokerkit replays `hh` again here, evidently meaning `new_hh`.
  newState = replayed(newHh).final;

  expect(operations(stateOf(newState).events)).toEqual(
    operations(stateOf(hand).events)
  );
  expect(formatPhh(hh)).toBe(formatPhh(newHh));
}
