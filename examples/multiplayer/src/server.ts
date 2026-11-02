import { Database } from "bun:sqlite";
import { sqliteStore } from "better-poker-engine/sqlite";

import { createApp } from "./app.ts";
import { bunDriver } from "./driver.ts";

const store = sqliteStore(bunDriver(new Database("poker.sqlite")));
await store.migrate();

export default {
  port: Number(process.env["PORT"] ?? 3000),
  fetch: createApp(store).fetch,
};
