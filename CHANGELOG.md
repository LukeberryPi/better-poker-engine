# Changelog

Every change to the published package. It follows semantic versioning;
before 1.0, a minor version may change the API.

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
