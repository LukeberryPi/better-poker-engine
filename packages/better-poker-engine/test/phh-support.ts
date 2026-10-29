import type { Hand } from "../src/hand.ts";
import {
  historyFromHand,
  parsePhh,
  replayHistory,
  type HistoryReplay,
  type Phh,
  type ReplayOptions,
} from "../src/phh.ts";

export function parsed(text: string): Phh {
  const history = parsePhh(text);
  if (!history.ok) throw new Error(JSON.stringify(history.error));
  return history.value;
}

export function replayed(
  history: Phh,
  options: ReplayOptions = {}
): HistoryReplay {
  const replay = replayHistory(history, options);
  if (!replay.ok) throw new Error(JSON.stringify(replay.error));
  return replay.value;
}

export function exported(hand: Hand): Phh {
  const history = historyFromHand(hand);
  if (!history.ok) throw new Error(JSON.stringify(history.error));
  return history.value;
}
