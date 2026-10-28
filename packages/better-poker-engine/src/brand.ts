declare const brand: unique symbol;

/** State only the engine can construct or read; at runtime it is plain JSON. */
export type Opaque<Name extends string> = { readonly [brand]: Name };
