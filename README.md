# better-poker-engine

A type-safe, immutable poker engine for TypeScript. It is a rewrite of
[pokerkit](https://github.com/uoftcprg/pokerkit) for people building poker
UIs, servers, hand-history tools and bots, and it is held to pokerkit's own
test suite.

> **Status: early.** Released before full parity with pokerkit; porting its
> remaining tests is in progress.

## What it is

- **A library, not a server.** One package that runs in browsers, Node, Bun,
  Deno and Workers. Multiplayer servers stay small: the package gives them
  redacted per-player views and stale-action protection: pass the `version`
  a player saw as `act(hand, action, { expectedVersion })`, and a double
  click or a late tab gets a `stale_version` violation instead of acting for
  the next player. Parse client JSON with the zod mini `playerActionSchema`
  before it reaches `act`: it refuses dealer steps such as `dealBoard`, so a
  client can never pick the cards. `actionSchema` adds the dealer steps, for
  trusted input only.
- **Pure.** A hand is deeply frozen plain data. `act(hand, action)` returns
  the next hand plus the events it produced, or a typed violation. Nothing
  reads a clock or a random source you did not pass in.
- **Safe to store.** `serializeHand(hand)` and `parseHand(text)` are the only
  supported way to store a hand. The text is the setup plus the event log;
  `parseHand` replays it and returns a typed error unless the replay gives
  back exactly the stored events, so an edited stack, card or action is
  refused and every loaded hand is one the engine played. A stored hand is
  auditor data, with the whole deck and every hole card: never send it to a
  client. Clients get `viewHand` and `eventsFor`.
- **Honest about money.** Amounts are integers in your smallest unit, side
  pots and all-ins are explicit, and hand-history stacks of unknown size are
  an explicit `unbounded` value.
- **Auditable.** Every transition emits events, and every hand ends in one
  wide record.
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

MIT. The licenses of pokerkit and of the phh-dataset files used as test
fixtures are reproduced in [`NOTICE`](NOTICE).
