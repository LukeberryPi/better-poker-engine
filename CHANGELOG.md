# Changelog

Every change to the published package. It follows semantic versioning;
before 1.0, a minor version may change the API.

## 0.3.0

### Added

- `planHand` and the table option `button: "dead"`: the big blind moves one
  player a hand, the small blind or button may be dead, missed blinds are
  owed, and new or returning players wait for the big blind or post with the
  table command `postBlinds`. Heads-up transitions never put the big blind on
  one player twice running.
- `startHand` table commands take the first hand's `button` seat.
- `evaluateStrength`, a table lookup for seven-card high hands; `equities`
  uses it and runs about twice as fast.

### Changed

- `seededRandom` is now `insecureSeededRandom`.
- Hands and tables refuse `JSON.stringify` and print as `Hand [sealed]`;
  store them with `serializeHand` and `serializeTable`.
- Hands keep the actions they accepted rather than every event; events replay
  when needed. Stored hands keep their format.
- Tables store as format 3, with blind seats and what each seat owes;
  `parseTable` still reads format 2 tables from 0.2.0.
- `handStarted` table events name the `smallBlind` and `bigBlind` seats.
- `secureRandom()` throws at once where Web Crypto is missing.
- `zod` and `smol-toml` take caret ranges.

## 0.2.0

### Added

- `Game.conventions`, with the presets `conventions.tournament`,
  `conventions.cashGame` and `conventions.tda2024`: needless folds, runout
  choices, partial shows, stranded pots, the big blind as a full bet (TDA
  Rule 47), a nominal big blind, ante precedence and odd chips.
- Rake caps per hand: `cap: { amount, per: "hand" }`.
- `actAs(hand, player, action, { expectedVersion })`, the server entry point.
- `engineVersion`, to record which engine plays a hand from its start.
- Showdown decisions carry `mayMuck`.
- From `main` since 0.1.0: `act`'s `expectedVersion` stale-action guard and
  deeply frozen hands; zod mini `playerActionSchema` and `actionSchema`;
  `serializeHand` and `parseHand`; per-pot contenders in hand records and
  `viewRecord`; tables (`createTable`, `actAtTable`, `viewTable`,
  `tableEventsFor`, `summarizeSession`, `serializeTable`, `parseTable`) with
  sitting out; the `better-poker-engine/sqlite` store; the Hono example.

### Changed

- `Game.mode` is now `Game.conventions`; builders still take `mode` as a
  preset name. `HandRecord.mode` is now `HandRecord.conventions`.
- `Rake.cap` is `{ amount, per }` instead of a number.
- By default, a fold or muck that would leave a pot nobody can win is
  refused. pokerkit leaves those chips unclaimed; set
  `strandedPots: "unclaimed"` to keep that, as PHH replays do.
- Showing or mucking before any hole card is dealt is refused.
- `historyFromHand` refuses hands whose conventions PHH replays can't play.

### Fixed

- Chips left in a pot nobody could win, after a needless fold in a cash game
  or a muck by a pot's last contender.

## 0.1.0

First release.
