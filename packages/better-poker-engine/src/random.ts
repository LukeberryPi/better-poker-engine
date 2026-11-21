/** Returns a uniformly random 32-bit unsigned integer per call. */
export type RandomSource = { readonly nextUint32: () => number };

// The engine compiles without DOM or Node types; this is all of Web Crypto it uses.
declare const crypto: {
  readonly getRandomValues: (array: Uint32Array) => Uint32Array;
};

/** Web Crypto randomness, the default for real games. Throws at once where the runtime
 * has none, as React Native without a polyfill. */
export function secureRandom(): RandomSource {
  let getRandomValues: (array: Uint32Array) => Uint32Array;
  try {
    getRandomValues = crypto.getRandomValues.bind(crypto);
  } catch (error) {
    throw new Error(
      "secureRandom needs Web Crypto's crypto.getRandomValues; on React Native, install a polyfill such as react-native-get-random-values",
      { cause: error }
    );
  }
  return {
    nextUint32: () => {
      const words = getRandomValues(new Uint32Array(1));
      return new DataView(words.buffer).getUint32(0);
    },
  };
}

/** For tests and replays, never for real games: 2³² seeds reach a sliver of the 52!
 * decks, and the output gives the state away. sfc32 seeded by splitmix32, modulo 2³²:
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md */
export function insecureSeededRandom(seed: number): RandomSource {
  const next = splitmix32(seed);
  return sfc32([next(), next(), next(), next()]);
}

/** All 128 bits of sfc32's state. */
export type Seed = readonly [number, number, number, number];

/** cyrb128 from the same page. */
export function seedFrom(text: string): Seed {
  let h1 = 1_779_033_703;
  let h2 = 3_144_134_277;
  let h3 = 1_013_904_242;
  let h4 = 2_773_480_762;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ code, 597_399_067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2_869_860_233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951_274_213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2_716_044_179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597_399_067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2_869_860_233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951_274_213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2_716_044_179);
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
    state = (state + 0x9e_37_79_b9) | 0;
    let mixed = Math.imul(state ^ (state >>> 16), 0x21_f0_aa_ad);
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x73_5a_2d_97);
    return (mixed ^ (mixed >>> 15)) >>> 0;
  };
}

/** A uniform integer in `[0, bound)`, for `1 <= bound <= 2 ** 32`. */
export function randomBelow(bound: number, random: RandomSource): number {
  const unbiased = 2 ** 32 - (2 ** 32 % bound);
  let value = random.nextUint32();
  while (value >= unbiased) {
    value = random.nextUint32();
  }
  return value % bound;
}
