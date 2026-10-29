import {
  isKnownCard,
  parseCards,
  type Card,
  type KnownCard,
} from "../src/cards.ts";
import type { RandomSource } from "../src/random.ts";

export function cards(text: string): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`Test cards do not parse: ${text}`);
  return [...parsed.value];
}

export function known(text: string): KnownCard[] {
  const parsed = cards(text);
  if (!parsed.every(isKnownCard)) {
    throw new Error(`Test cards are not all known: ${text}`);
  }
  return parsed;
}

export function scripted(values: readonly number[]): RandomSource {
  const remaining = [...values];
  return {
    nextUint32: () => {
      const value = remaining.shift();
      if (value === undefined) throw new Error("Scripted values ran out");
      return value;
    },
  };
}
