declare const brand: unique symbol;

/** State only the engine can construct or read; at runtime it is plain JSON. */
export type Opaque<Name extends string> = { readonly [brand]: Name };

/** Mixed into the type behind an `Opaque`, so one assertion converts either way. */
export type Brandable<Name extends string> = { readonly [brand]?: Name };
