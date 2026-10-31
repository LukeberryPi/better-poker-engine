import * as z from "zod/mini";

import type { HandRecord } from "./events.ts";
import { err, ok, type Result } from "./result.ts";
import { handRecordSchema, tableEventSchema } from "./schemas.ts";
import { parseTable, serializeTable } from "./storage.ts";
import {
  tableStateOf,
  type Table,
  type TableEvent,
  type TableRejection,
  type TableTransition,
} from "./table.ts";

export type SqlValue = string | number | null;

export type SqlRow = Readonly<Record<string, SqlValue>>;

export type SqlStatement = {
  readonly sql: string;
  readonly params: readonly SqlValue[];
};

/** Wraps any SQLite driver: bun:sqlite, better-sqlite3, Cloudflare D1, libSQL. */
export type SqliteDriver = {
  /** Runs the statements in one transaction; resolves to the rows each one changed. */
  readonly batch: (
    statements: readonly SqlStatement[]
  ) => Promise<readonly number[]>;
  readonly all: (
    sql: string,
    params: readonly SqlValue[]
  ) => Promise<readonly SqlRow[]>;
};

export type StoreConflict =
  | { readonly code: "exists"; readonly id: string }
  /** Another write landed first: load the table again and retry. */
  | { readonly code: "conflict"; readonly id: string };

/** Promises reject when the driver fails or a stored row does not parse. */
export type TableStore = {
  readonly migrate: () => Promise<void>;
  readonly insertTable: (
    id: string,
    table: Table
  ) => Promise<Result<number, StoreConflict>>;
  readonly loadTable: (id: string) => Promise<Table | null>;
  /** Writes only if the stored table is still the one `transition` started from. */
  readonly saveTransition: (
    id: string,
    transition: TableTransition
  ) => Promise<Result<number, StoreConflict>>;
  readonly saveRejection: (
    id: string,
    table: Table,
    rejection: TableRejection
  ) => Promise<void>;
  readonly events: (id: string, afterSeq?: number) => Promise<TableEvent[]>;
  readonly handRecords: (id: string) => Promise<HandRecord[]>;
};

const migrations = [
  `CREATE TABLE IF NOT EXISTS poker_tables (
    id TEXT PRIMARY KEY, version INTEGER NOT NULL, state TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS poker_table_events (
    table_id TEXT NOT NULL, seq INTEGER NOT NULL, version INTEGER NOT NULL,
    event TEXT NOT NULL, PRIMARY KEY (table_id, seq))`,
  `CREATE TABLE IF NOT EXISTS poker_hand_records (
    table_id TEXT NOT NULL, hand INTEGER NOT NULL, record TEXT NOT NULL,
    PRIMARY KEY (table_id, hand))`,
  `CREATE TABLE IF NOT EXISTS poker_rejections (
    table_id TEXT NOT NULL, version INTEGER NOT NULL, rejection TEXT NOT NULL)`,
];

/** Matching the whole state, not just the version, keeps a losing writer's rows out. */
const written =
  "EXISTS (SELECT 1 FROM poker_tables WHERE id = ? AND version = ? AND state = ?)";

function column(rows: readonly SqlRow[], name: string): string[] {
  return rows.map((row) => {
    const value = row[name];
    const parsed = z.string().safeParse(value);
    if (!parsed.success) {
      throw new Error(`Stored ${name} is not text`, { cause: parsed.error });
    }
    return parsed.data;
  });
}

function parseRow<Stored>(schema: z.ZodMiniType<Stored>, text: string): Stored {
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error("A stored row does not parse", { cause: parsed.error });
  }
  return parsed.data;
}

export function sqliteStore(driver: SqliteDriver): TableStore {
  return {
    async migrate() {
      await driver.batch(migrations.map((sql) => ({ sql, params: [] })));
    },

    async insertTable(id, table) {
      const { version } = tableStateOf(table);
      const [inserted] = await driver.batch([
        {
          sql: "INSERT OR IGNORE INTO poker_tables (id, version, state) VALUES (?, ?, ?)",
          params: [id, version, serializeTable(table)],
        },
      ]);
      return inserted === 1 ? ok(version) : err({ code: "exists", id });
    },

    async loadTable(id) {
      const rows = await driver.all(
        "SELECT state FROM poker_tables WHERE id = ?",
        [id]
      );
      const [state] = column(rows, "state");
      if (state === undefined) return null;
      const parsed = parseTable(state);
      if (!parsed.ok) {
        throw new Error(`Stored table ${id} does not load`, {
          cause: parsed.error,
        });
      }
      return parsed.value;
    },

    async saveTransition(id, { table, events }) {
      const { version } = tableStateOf(table);
      const state = serializeTable(table);
      const guard = [id, version, state];
      const records = events.flatMap(({ body }) =>
        body.type === "handEnded" ? [body] : []
      );
      const [updated] = await driver.batch([
        {
          sql: "UPDATE poker_tables SET version = ?, state = ? WHERE id = ? AND version = ?",
          params: [version, state, id, version - 1],
        },
        ...events.map((event) => ({
          sql: `INSERT OR IGNORE INTO poker_table_events (table_id, seq, version, event)
            SELECT ?, ?, ?, ? WHERE ${written}`,
          params: [
            id,
            event.seq,
            event.version,
            JSON.stringify(event),
            ...guard,
          ],
        })),
        ...records.map(({ hand, record }) => ({
          sql: `INSERT OR IGNORE INTO poker_hand_records (table_id, hand, record)
            SELECT ?, ?, ? WHERE ${written}`,
          params: [id, hand, JSON.stringify(record), ...guard],
        })),
      ]);
      return updated === 1 ? ok(version) : err({ code: "conflict", id });
    },

    async saveRejection(id, table, rejection) {
      await driver.batch([
        {
          sql: "INSERT INTO poker_rejections (table_id, version, rejection) VALUES (?, ?, ?)",
          params: [id, tableStateOf(table).version, JSON.stringify(rejection)],
        },
      ]);
    },

    async events(id, afterSeq = 0) {
      const rows = await driver.all(
        "SELECT event FROM poker_table_events WHERE table_id = ? AND seq > ? ORDER BY seq",
        [id, afterSeq]
      );
      return column(rows, "event").map((text) =>
        parseRow(tableEventSchema, text)
      );
    },

    async handRecords(id) {
      const rows = await driver.all(
        "SELECT record FROM poker_hand_records WHERE table_id = ? ORDER BY hand",
        [id]
      );
      return column(rows, "record").map((text) =>
        parseRow(handRecordSchema, text)
      );
    },
  };
}
