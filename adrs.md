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
   source. State is immutable plain data and JSON-serializable.
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
   between hands. Not in scope: sit-out, missed or dead blinds, top-ups,
   tournament levels.
10. **Audit:** per-transition events plus one wide record per hand and per
    session. Rejected attempts are recorded. Views redact per audience
    (player, spectator, auditor). Persistence is the optional `/sqlite` module
    over any SQLite driver.
11. **Validation:** zod mini schemas at every boundary (client JSON, PHH,
    stored rows). Wire types derive from those schemas.
12. **House rules:** the anti-slop oxlint plugin and `AGENTS.md`.
13. **Randomness:** the package ships two `RandomSource` adapters,
    `secureRandom()` (Web Crypto `getRandomValues`, the default for real games)
    and `seededRandom(seed)` (reproducible tests and replays). Engine
    transitions only use a source or deck the caller passes in; only the
    adapter file may touch `crypto`, enforced by lint.
14. **Two levels.** The hand module (`startHand`, `act`, `viewHand`,
    `summarizeHand`, `replayHand`) is the engine and the pokerkit parity
    surface. The table module (`createTable`, `actAtTable`, `viewTable`,
    `summarizeSession`) is for play: identities, sessions, persistence.
15. **Opaque state.** Hands and tables are opaque JSON; everything else is
    plain data. Brands exist only on those two types and on redacted event
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

## Out of scope for v1

- **Name-keyed statistics from PHH files.** pokerkit's
  `Statistics.from_hand_history` keys payoffs by player name, merging repeated
  names. It is documented but untested upstream. Our `statistics()` keys by
  player id; a name-keyed variant is a follow-up.
- **ACPC log import.** pokerkit's `ACPCProtocolParser` reads ACPC competition
  logs into hand histories. Like the dropped site parsers, it is untested
  upstream. ACPC export stays (decision 7).
