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
- **Tables for play.** `createTable`, `actAtTable`, `viewTable` and
  `summarizeSession` run a session of hands: seats map to positions, the
  button moves to the next seat dealt in (heads-up, it posts the small
  blind), stacks carry over, and players join any time and leave whenever
  they hold no cards. `actAtTable` is the one write. Its `act` command takes
  the player your server authenticated and the table `version` they saw, and
  a rejection comes back with the attempt so you can store it. Each hand
  deals a whole shuffled deck you pass in, and automates every step except
  betting and drawing, so voluntary shows, mucks and run-it-twice are
  refused. `serializeTable` and `parseTable` store a table as its command
  log, under the same rules as hands; `tableEventsFor` redacts its events.
  Not supported: sitting out, missed or dead blinds, top-ups and tournament
  levels.
- **An optional SQLite store.** `better-poker-engine/sqlite` keeps tables,
  their events, hand records and rejected attempts over any SQLite driver
  you wrap in two functions: `batch`, which runs statements in one
  transaction and resolves to the rows each changed, and `all`.
  `saveTransition` writes only if the stored table is still the version the
  move started from, so two servers acting on one table cannot both land;
  the loser gets `conflict` and retries from a fresh load. Rows read back
  are parsed with zod mini.
- **Pure.** A hand is deeply frozen plain data. `act(hand, action)` returns
  the next hand plus the events it produced, or a typed violation. Nothing
  reads a clock or a random source you did not pass in.
- **Safe to store.** `serializeHand(hand)` and `parseHand(text)` are the only
  supported way to store a hand. The text is the setup plus the event log;
  `parseHand` replays it and, without throwing, returns a typed error unless
  the replay gives back exactly the stored events. So every loaded hand is
  one the engine played, with every chip and card accounted for, and an
  edited stack or dealt card is refused. An edit the events never contradict,
  such as an undealt card, still loads: sign the text if you need tamper
  evidence. A hand loads only in an engine that replays it the same way, so
  keep the version that stored it. A stored hand is
  auditor data, with the whole deck and every hole card: never send it to a
  client. Clients get `viewHand` and `eventsFor`.
- **Honest about money.** Amounts are integers in your smallest unit, side
  pots and all-ins are explicit, and hand-history stacks of unknown size are
  an explicit `unbounded` value.
- **Auditable.** Every transition emits events, and every hand ends in one
  wide record: `summarizeHand(hand)`, with a record per pot of what it held,
  who could win it and who did. That record holds every hole card; give
  history screens `viewRecord(record, audience)` instead.
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
