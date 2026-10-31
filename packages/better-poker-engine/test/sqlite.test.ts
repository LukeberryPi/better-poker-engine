import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { decks, shuffle } from "../src/cards.ts";
import { seededRandom } from "../src/random.ts";
import { holdem } from "../src/rules.ts";
import {
  sqliteStore,
  type SqlRow,
  type SqliteDriver,
  type SqlValue,
} from "../src/sqlite.ts";
import {
  actAtTable,
  createTable,
  viewTable,
  type Table,
  type TableCommand,
  type TableEvent,
  type TableTransition,
} from "../src/table.ts";
import { okValue } from "./support.ts";

function bunDriver(db: Database): SqliteDriver {
  return {
    batch: async (statements) =>
      db.transaction(() =>
        statements.map(
          ({ sql, params }) => db.query(sql).run(...params).changes
        )
      )(),
    all: async (sql, params) =>
      db.query<SqlRow, SqlValue[]>(sql).all(...params),
  };
}

const auditor = { kind: "auditor" } as const;
const game = holdem.noLimit({ blinds: [1, 2], minBet: 2 });

async function openStore() {
  const db = new Database(":memory:");
  const store = sqliteStore(bunDriver(db));
  await store.migrate();
  return { db, store };
}

function step(table: Table, command: TableCommand): TableTransition {
  const next = actAtTable(table, command);
  if (!next.ok) throw new Error(JSON.stringify(next.error));
  return next.value;
}

function seated(): Table {
  let table = okValue(createTable({ game, seats: 4 }));
  for (const [seat, player] of ["a", "b"].entries()) {
    table = step(table, { type: "join", player, seat, stack: 100 }).table;
  }
  return table;
}

const deal = {
  type: "startHand",
  deck: shuffle(decks.standard, seededRandom(1)),
} as const;

/** Folds or calls each decision until the hand ends, loading and saving each time. */
async function playStored(
  store: Awaited<ReturnType<typeof openStore>>["store"],
  id: string
): Promise<TableEvent[]> {
  const events: TableEvent[] = [];
  for (let moves = 0; moves < 200; moves += 1) {
    const table = await store.loadTable(id);
    if (table === null) throw new Error("No table");
    const view = viewTable(table, auditor);
    if (view.hand === null && view.hands === 2) return events;
    const decision = view.hand?.decision;
    if (decision !== undefined && decision.kind !== "betting") {
      throw new Error(`A table asked for ${decision.kind}`);
    }
    const transition = step(
      table,
      decision === undefined
        ? deal
        : {
            type: "act",
            player: decision.player,
            expectedVersion: view.version,
            action: { type: "checkOrCall" },
          }
    );
    expect(await store.saveTransition(id, transition)).toEqual({
      ok: true,
      value: viewTable(transition.table, auditor).version,
    });
    events.push(...transition.events);
  }
  throw new Error("The session did not finish");
}

describe("sqliteStore", () => {
  test("keeps a table, its events and its hand records across saves", async () => {
    const { store } = await openStore();
    const start = seated();
    expect(await store.insertTable("t1", start)).toEqual({
      ok: true,
      value: 2,
    });
    const events = await playStored(store, "t1");
    const loaded = await store.loadTable("t1");
    if (loaded === null) throw new Error("No table");
    expect(viewTable(loaded, auditor).hands).toBe(2);
    expect(await store.events("t1")).toEqual(events);
    const records = events.flatMap(({ body }) =>
      body.type === "handEnded" ? [body.record] : []
    );
    expect(records.length).toBe(2);
    expect(await store.handRecords("t1")).toEqual(records);
    const [, second] = events;
    expect(await store.events("t1", second?.seq)).toEqual(events.slice(2));
  });

  test("lets only the first of two writers from one version land", async () => {
    const { store } = await openStore();
    const start = seated();
    await store.insertTable("t1", start);
    const joined = step(start, {
      type: "join",
      player: "c",
      seat: 2,
      stack: 50,
    });
    const dealt = step(start, deal);
    expect(dealt.events.length).toBeGreaterThan(joined.events.length);
    expect(await store.saveTransition("t1", joined)).toEqual({
      ok: true,
      value: 3,
    });
    expect(await store.saveTransition("t1", dealt)).toEqual({
      ok: false,
      error: { code: "conflict", id: "t1" },
    });
    expect(await store.events("t1")).toEqual([...joined.events]);
    expect(await store.handRecords("t1")).toEqual([]);
    const loaded = await store.loadTable("t1");
    expect(loaded && viewTable(loaded, auditor)).toEqual(
      viewTable(joined.table, auditor)
    );
  });

  test("refuses a second table under the same id", async () => {
    const { store } = await openStore();
    await store.insertTable("t1", seated());
    expect(await store.insertTable("t1", seated())).toEqual({
      ok: false,
      error: { code: "exists", id: "t1" },
    });
  });

  test("records a rejection with its attempt and the version it met", async () => {
    const { db, store } = await openStore();
    const table = seated();
    const attempt = { type: "leave", player: "z" } as const;
    const rejected = actAtTable(table, attempt);
    if (rejected.ok) throw new Error("Accepted");
    await store.saveRejection("t1", table, rejected.error);
    const rows = db
      .query<{ version: number; rejection: string }, []>(
        "SELECT version, rejection FROM poker_rejections"
      )
      .all();
    expect(
      rows.map(({ version, rejection }) => [version, JSON.parse(rejection)])
    ).toEqual([
      [2, { attempt, violation: { code: "not_seated", player: "z" } }],
    ]);
  });

  test("reads a missing table as null and rejects a corrupt one", async () => {
    const { db, store } = await openStore();
    expect(await store.loadTable("t1")).toBeNull();
    db.query("INSERT INTO poker_tables VALUES ('t1', 0, '{}')").run();
    await expect(store.loadTable("t1")).rejects.toThrow("Stored table t1");
  });
});
