import type { Database } from "bun:sqlite";
import type {
  SqlRow,
  SqliteDriver,
  SqlValue,
} from "better-poker-engine/sqlite";

export function bunDriver(db: Database): SqliteDriver {
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
