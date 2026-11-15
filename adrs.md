# Decisions

Agreed with the project owner. Do not re-litigate without real friction.

1. **Library only.** No published server. Multiplayer servers belong to the
   app; the package supplies what makes them small and safe. Hono appears only
   in `examples/multiplayer`.
2. **One npm package, `better-poker-engine`,** with subpath exports: the core,
   `/phh`, `/analysis`, `/sqlite`. Importing the core never loads TOML, SQL or
   analysis code. Unscoped name, MIT. Releases do not wait for full parity,
   but every file in `parity/required.ts` must be green to release.
3. **Runtimes:** pure ESM, no Bun-only APIs in the package. Bun is the dev
   loop, test runner and build tool.
4. **Money:** integer amounts in the table's smallest unit. Decimals exist only
   at the PHH boundary. A stack whose size is unknown (hand histories) is an
   explicit `unbounded` value, never `Infinity` or a float.
5. **Purity:** the engine never reads a clock, a random source, globals, or
   does I/O. Deck order comes from an explicit deck or an injected random
   source. State is immutable plain data. Hands and tables refuse
   `JSON.stringify` and Node's inspector, since they hold the deck and every
   hole card: `serializeHand` and `serializeTable` store them.
6. **Errors:** game-rule violations are returned values (`Result`), never
   thrown. Each violation is a closed union carrying the numbers involved.
7. **Formats:** PHH (read/write), ACPC and Pluribus export. The six online-site
   parsers from pokerkit are dropped.
8. **Parity with pokerkit `abf7952`:** all 161 unit tests and 1,170 doctest
   examples are ported. "Same behavior" means the same accept/reject decision
   and the same resulting stacks, pots, cards and operations, not Python error
   text or `repr`. Doctests that expect a `TypeError` become compile-time
   `@ts-expect-error` checks. `parity/manifest.ts` maps every original id to
   its TypeScript test and CI fails when a required id is missing or red.
   Examples that cannot keep pokerkit's result are listed with a reason in
   `parity/deviations.ts`, and CI prints them all. A deviation is allowed only
   when an ADR removed the feature, JavaScript semantics make the result
   impossible, or a JavaScript built-in does the job.
9. **Sessions:** a table runs consecutive hands: seats mapped to positions,
   button movement including heads-up, stacks carried over, joining and leaving
   between hands, and sitting out: seated with chips but not dealt in. A table
   moves its button, or keeps a dead button with missed blinds, waiting for
   the big blind or posting it (decision 25). Not in scope: top-ups and
   tournament levels, which belong to the server.
10. **Audit:** per-transition events plus one wide record per hand and per
    session. Rejected attempts are recorded. Views redact per audience
    (player, spectator, auditor). Persistence is the optional `/sqlite` module
    over any SQLite driver.
11. **Validation:** zod mini schemas at every boundary (client JSON, PHH,
    stored rows). Wire types derive from those schemas.
12. **House rules:** the anti-slop oxlint plugin and `AGENTS.md`.
13. **Randomness:** the package ships two `RandomSource` adapters,
    `secureRandom()` (Web Crypto `getRandomValues`, the default for real games)
    and `insecureSeededRandom(seed)` (reproducible tests and replays). Engine
    transitions only use a source or deck the caller passes in; only the
    adapter file may touch `crypto`, enforced by lint.
14. **Two levels.** The hand module (`startHand`, `act`, `viewHand`,
    `summarizeHand`, `replayHand`) is the engine and the pokerkit parity
    surface. The table module (`createTable`, `actAtTable`, `viewTable`,
    `summarizeSession`) is for play: identities, sessions, persistence.
15. **Opaque state.** Hands and tables are opaque and sealed (decision 5);
    everything else is plain data. Brands exist only on those two types and on redacted event
    views, because a redacted event has the same structure as a raw one.
16. **Players are named by id everywhere.** Positions only describe order.
    An action that names no player belongs to the next player in order; one
    that names a player may come from anyone eligible for it, as in pokerkit.
    PHH replays name players `p1`..`pN`.
17. **Time and ids belong to whoever records.** The engine never asks for
    timestamps, hand ids or session clocks.
18. **One write per level.** `act` and `actAtTable` each return one error
    union; rejections at a table carry the attempt so it can be persisted.
    Store promises reject on driver failure; `Result` is for game outcomes.
19. **Table automation.** Table hands automate every step except betting and
    drawing. Run-it-twice and voluntary shows are available in single hands
    but not at tables in v1.
20. **Stored tables stay small.** A stored table is the table as it stood
    before the running hand, plus the commands since. `parseTable` replays
    only those, so loading and acting cost the same however many hands the
    table has played. Stacks and the session at that point are trusted as
    stored; the event log and hand records are the audit trail.
21. **Conventions.** Where pokerkit and card rooms rule differently,
    `Game.conventions` says which rule a game plays. pokerkit's rules stay the
    default, so parity holds; `conventions.tda2024` is the card-room preset,
    and `mode` names pokerkit's two presets.
22. **No stranded pots by default.** pokerkit lets a needless fold or a muck
    leave a pot that nobody can win, and burns it. Hand histories need that;
    a game that moves value can't afford it. `strandedPots: "refused"` is
    the default; PHH replays and the parity tests that strand pots opt into
    `"unclaimed"`.
23. **Servers act through `actAs`.** It names the authenticated player,
    requires `expectedVersion` and accepts player actions only. `act` keeps
    pokerkit's calling conventions (decision 16) for replays and tools.
24. **Hands keep their inputs.** A hand holds its setup and the actions it
    accepted; events replay from them when a record, a stored hand or a PHH
    history needs them. Events are outputs, and copying each one's snapshot
    into every later hand made hands grow with every action.
25. **Seating is data.** `planHand` decides who plays the next hand, where,
    and for which blinds, from seats, the last hand's blind seats and the
    button rule. Tables use it, and a server that keeps its own table state
    can call it directly. Time, money and product policy stay with the server.

## Out of scope for v1

- **Name-keyed statistics from PHH files.** pokerkit's
  `Statistics.from_hand_history` keys payoffs by player name, merging repeated
  names. It is documented but untested upstream. Our `statistics()` keys by
  player id; a name-keyed variant is a follow-up.
- **ACPC log import.** pokerkit's `ACPCProtocolParser` reads ACPC competition
  logs into hand histories. Like the dropped site parsers, it is untested
  upstream. ACPC export stays (decision 7).
