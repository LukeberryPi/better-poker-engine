/** Returns a uniformly random 32-bit unsigned integer per call. */
export type RandomSource = { readonly nextUint32: () => number };

// The engine compiles without DOM or Node types; this is all of Web Crypto it uses.
declare const crypto: {
  readonly getRandomValues: (array: Uint32Array) => Uint32Array;
};

/** Web Crypto randomness, the default for real games. */
export function secureRandom(): RandomSource {
  return {
    nextUint32: () => {
      const words = crypto.getRandomValues(new Uint32Array(1));
      return new DataView(words.buffer).getUint32(0);
    },
  };
}

/** sfc32 seeded by splitmix32: https://github.com/bryc/code/blob/master/jshash/PRNGs.md.
 * A seed, taken modulo 2 ** 32, gives the same sequence on every runtime. */
export function seededRandom(seed: number): RandomSource {
  const next = splitmix32(seed);
  return sfc32([next(), next(), next(), next()]);
}

/** All 128 bits of sfc32's state. */
export type Seed = readonly [number, number, number, number];

/** cyrb128 from the same page. */
export function seedFrom(text: string): Seed {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function sfc32(seed: Seed): RandomSource {
  let [a, b, c, counter] = seed;
  return {
    nextUint32: () => {
      const result = (a + b + counter) | 0;
      counter = (counter + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (((c << 21) | (c >>> 11)) + result) | 0;
      return result >>> 0;
    },
  };
}

function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) | 0;
    let mixed = Math.imul(state ^ (state >>> 16), 0x21f0aaad);
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97);
    return (mixed ^ (mixed >>> 15)) >>> 0;
  };
}

/** A uniform integer in `[0, bound)`, for `1 <= bound <= 2 ** 32`. */
export function randomBelow(bound: number, random: RandomSource): number {
  const unbiased = 2 ** 32 - (2 ** 32 % bound);
  let value = random.nextUint32();
  while (value >= unbiased) value = random.nextUint32();
  return value % bound;
}
