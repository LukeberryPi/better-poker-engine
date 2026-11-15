# better-poker-engine

A type-safe, immutable poker engine for TypeScript. It is a rewrite of
[pokerkit](https://github.com/uoftcprg/pokerkit) for people building poker
UIs, servers, hand-history tools and bots, and it is held to pokerkit's own
test suite.

> **Status: pre-1.0.** A minor version may change the API; every change is in
> [`CHANGELOG.md`](CHANGELOG.md). CI runs pokerkit's tests and prints the
> parity report; every pokerkit module listed in `parity/required.ts` must be
> fully green to release.

## Quick start

```ts
import {
  actAs,
  automation,
  conventions,
  decks,
  holdem,
  secureRandom,
  shuffle,
  startHand,
  viewHand,
} from "better-poker-engine";

const game = holdem.noLimit({
  blinds: [50, 100],
  minBet: 100,
  conventions: conventions.tda2024,
});
const started = startHand({
  game,
  players: ["ann", "bo", "cy"],
  stacks: [10_000, 10_000, 10_000],
  deck: shuffle(decks.standard, secureRandom()),
  automate: automation.all,
});
if (!started.ok) throw new Error(started.error.code);

// Cy is first to act. The server names who it authenticated and the version Cy saw.
const seen = viewHand(started.value.hand, { kind: "player", player: "cy" });
const acted = actAs(
  started.value.hand,
  "cy",
  { type: "betOrRaiseTo", amount: 300 },
  { expectedVersion: seen.version }
);
if (!acted.ok) throw new Error(acted.error.code);

// Ann sees her own cards and nobody else's; send each player their own view.
const view = viewHand(acted.value.hand, { kind: "player", player: "ann" });
console.log(
  view.decision,
  view.players.map((player) => player.holeCards)
);
```

## Rules: pokerkit's, or a card room's

pokerkit is a research tool, and on a few questions its rules are not the
ones a card room plays. `Game.conventions` says which rule a game uses.
Builders default to `conventions.tournament`; `mode: "cashGame"` picks
`conventions.cashGame`, and `conventions.tda2024` plays the
[TDA rules](https://www.pokertda.com/view-poker-tda-rules/) as of 2024.

| Convention                                                                       | `tournament` | `cashGame`    | `tda2024` |
| -------------------------------------------------------------------------------- | ------------ | ------------- | --------- |
| `needlessFolds`: fold when a check is free                                       | refused      | allowed       | refused   |
| `runouts`: who picks how often an all-in board runs                              | once         | playersChoose | once      |
| `partialShows`: show some hole cards, keep others down                           | refused      | allowed       | refused   |
| `strandedPots`: fold or muck away a pot nobody else can win                      | refused      | refused       | refused   |
| `bigBlindIsFullBet`: a short all-in over the blind reopens nothing (TDA Rule 47) | false        | false         | true      |
| `nominalBigBlind`: a short big blind still prices the call and raise             | false        | false         | true      |
| `antePrecedence`: what a short big blind posts first with a big blind ante       | ante         | ante          | blind     |
| `oddChips`: who gets a split pot's odd chips                                     | firstShare   | firstShare    | oneEach   |

Every preset refuses stranded pots. pokerkit leaves such a pot unclaimed, and
its own tests burn those chips, because hand histories record folds like that;
`strandedPots: "unclaimed"` keeps pokerkit's behavior, and PHH replays use it.
PHH replays with pokerkit's rules, so `historyFromHand` refuses a hand whose
last four conventions differ from them. Rake caps apply `per: "pot"`, as in
pokerkit, or `per: "hand"`.

## What it is

- **A library, not a server.** One package that runs in browsers, Node, Bun,
  Deno and Workers. It never runs your server, but keeps it small:
  [`examples/multiplayer`](examples/multiplayer) is a Hono server built on
  the tables and SQLite store below. Its `x-player` header stands in for
  authentication; real auth, websockets and rate limits are yours to add.
  Servers act through `actAs(hand, player, action, { expectedVersion })`:
  the player is the one you authenticated, a double click or a late tab gets
  a `stale_version` violation instead of acting for the next player, and
  dealer steps don't type-check. `act` is the lower-level call, as in
  pokerkit: an action that names no player belongs to the next one in order.
  Parse client JSON with the zod mini `playerActionSchema` before it reaches
  the engine: it refuses dealer steps such as `dealBoard`, so a client can
  never pick the cards. `actionSchema` adds the dealer steps, for trusted
  input only.
- **Tables for play.** `createTable`, `actAtTable`, `viewTable` and
  `summarizeSession` run a session of hands: seats map to positions, the
  button moves to the next seat dealt in (heads-up, it posts the small
  blind), stacks carry over, and players join any time and leave whenever
  they hold no cards. `actAtTable` is the one write. Its `act` command takes
  the player your server authenticated and the table `version` they saw, and
  a rejection comes back with the attempt so you can store it. Each hand
  deals a whole shuffled deck you pass in, and automates every step except
  betting and drawing, so voluntary shows, mucks and run-it-twice are
  refused. `serializeTable` and `parseTable` store a table as it stood
  before the running hand plus the commands since, so a table loads as fast
  at hand 1,000 as at hand 1. Only those commands are replayed: stacks and
  the session before the hand are trusted as stored, so sign the text if you
  need tamper evidence. `tableEventsFor` redacts its events. A player who
  steps away sends `sitOut`: they keep their seat and stack, play out any
  hand they hold cards in, and are dealt out from the next hand until
  `sitIn`. Seat views and events show it. The engine never times anyone out,
  so your server decides when an absent player sits out. No missed or dead
  blinds are charged, so a player who sits out over the blinds pays none
  when they return. Not supported: missed or dead blinds, top-ups and
  tournament levels.
- **An optional SQLite store.** `better-poker-engine/sqlite` keeps tables,
  their events, hand records and rejected attempts over any SQLite driver
  you wrap in two functions: `batch`, which runs statements in one
  transaction and resolves to the rows each changed, and `all`.
  `saveTransition` writes only if the stored table is still the version the
  move started from, so two servers acting on one table cannot both land;
  the loser gets `conflict` and retries from a fresh load. Rows read back
  are parsed with zod mini.
- **Pure.** Hands and tables are deeply frozen plain data. `act(hand, action)` returns
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
  keep the version that stored it. A stored hand is auditor data, with the
  whole deck and every hole card: never send it to a client. Clients get
  `viewHand` and `eventsFor`.
- **Honest about money.** Amounts are integers in your smallest unit, side
  pots and all-ins are explicit, no pot is stranded unless you ask for
  pokerkit's behavior, and hand-history stacks of unknown size are an
  explicit `unbounded` value.
- **Auditable.** Every transition emits events, and every hand ends in one
  wide record: `summarizeHand(hand)`, with the conventions it played under
  and a record per pot of what it held, who could win it and who did. That
  record holds every hole card; give history screens
  `viewRecord(record, audience)` instead.
- **Hand histories.** Reads and writes PHH, and exports ACPC and Pluribus logs.

## Parity with pokerkit

The bar is pokerkit at commit `abf7952`: 161 unit tests and 1,170 doctest
examples. `parity/manifest.ts` lists every one of them, and CI fails when a
ported module has any of its cases missing or failing. "Same behavior" means
the same accept/reject decisions and the same resulting stacks, pots and
cards. Python error text is not compared. Conventions other than pokerkit's
are opt-in, except `strandedPots`; the two pokerkit tests that strand pots
play under `strandedPots: "unclaimed"`.

## Development

```sh
bun install
bun run check   # format, lint, typecheck, tests, parity report, tarball
cd examples/multiplayer && bun run start   # the Hono example; PORT defaults to 3000
```

Decisions live in [`adrs.md`](adrs.md); house rules for contributors and
agents live in [`AGENTS.md`](AGENTS.md).

## License

MIT. The licenses of pokerkit and of the phh-dataset files used as test
fixtures are reproduced in [`NOTICE`](NOTICE).
