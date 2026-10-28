# better-poker-engine

A type-safe, immutable poker engine for TypeScript. It is a rewrite of
[pokerkit](https://github.com/uoftcprg/pokerkit) for people building poker
UIs, servers, hand-history tools and bots, and it is held to pokerkit's own
test suite.

> **Status: under construction.** Nothing is published yet. The package ships
> to npm once every pokerkit test passes.

## What it is

- **A library, not a server.** One package that runs in browsers, Node, Bun,
  Deno and Workers. Multiplayer servers stay small: the package gives them
  redacted per-player views, stale-action protection, zod mini input schemas
  and an optional SQLite audit store.
- **Pure.** A hand is immutable JSON. `act(hand, action)` returns the next
  hand plus the events it produced, or a typed violation. Nothing reads a
  clock or a random source you did not pass in.
- **Honest about money.** Amounts are integers in your smallest unit, side
  pots and all-ins are explicit, and hand-history stacks of unknown size are
  an explicit `unbounded` value.
- **Auditable.** Every transition emits events; every hand and session ends in
  one wide record; rejected attempts are kept.
- **Hand histories.** Reads and writes PHH, and exports ACPC and Pluribus logs.

## Parity with pokerkit

The bar is pokerkit at commit `abf7952`: 161 unit tests and 1,170 doctest
examples. `parity/manifest.ts` lists every one of them, and CI fails when a
ported module has any of its cases missing or failing. "Same behavior" means
the same accept/reject decisions and the same resulting stacks, pots and
cards. Python error text is not compared.

## Development

```sh
bun install
bun run check   # format, lint, typecheck, tests, parity report
```

Decisions live in [`adrs.md`](adrs.md); house rules for contributors and
agents live in [`AGENTS.md`](AGENTS.md).

## License

MIT. pokerkit's license is reproduced in [`NOTICE`](NOTICE).
