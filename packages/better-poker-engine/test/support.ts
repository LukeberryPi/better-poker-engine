import type { RandomSource } from "../src/random.ts";

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
