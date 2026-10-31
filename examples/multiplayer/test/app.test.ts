import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";

import {
  seededRandom,
  tableEventsFor,
  viewTable,
  type Audience,
  type PlayerId,
  type Table,
} from "better-poker-engine";
import { sqliteStore } from "better-poker-engine/sqlite";

import { createApp } from "../src/app.ts";
import { bunDriver } from "../src/driver.ts";

type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json };

const auditor = { kind: "auditor" } as const;

async function dealtTable() {
  const db = new Database(":memory:");
  const store = sqliteStore(bunDriver(db));
  await store.migrate();
  const app = createApp(store, seededRandom(1));
  const headersFor = (player: PlayerId | null) => {
    const headers = new Headers({ "content-type": "application/json" });
    if (player !== null) headers.set("x-player", player);
    return headers;
  };
  const request = (path: string, player: PlayerId | null) =>
    app.request(path, { headers: headersFor(player) });
  const post = (path: string, player: PlayerId | null, body: Json = {}) =>
    app.request(path, {
      method: "POST",
      headers: headersFor(player),
      body: JSON.stringify(body),
    });
  await post("/tables/t1", null);
  await post("/tables/t1/join", "a", { seat: 0, stack: 100 });
  await post("/tables/t1/join", "b", { seat: 1, stack: 100 });
  await post("/tables/t1/deal", "a");
  const stored = async (): Promise<Table> => {
    const table = await store.loadTable("t1");
    if (table === null) throw new Error("No table");
    return table;
  };
  const { version } = viewTable(await stored(), auditor);
  return { db, store, request, post, stored, version };
}

function wire<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value));
}

test("sends each audience the view of the table redacted for it", async () => {
  const { request, stored } = await dealtTable();
  const audiences: readonly [PlayerId | null, Audience][] = [
    ["a", { kind: "player", player: "a" }],
    ["b", { kind: "player", player: "b" }],
    [null, { kind: "spectator" }],
  ];
  for (const [player, audience] of audiences) {
    const response = await request("/tables/t1", player);
    expect(await response.json()).toEqual(
      wire(viewTable(await stored(), audience))
    );
  }
});

test("sends events redacted for the requesting audience", async () => {
  const { store, request } = await dealtTable();
  const events = await store.events("t1");
  const response = await request("/tables/t1/events?after=2", "b");
  expect(await response.json()).toEqual(
    wire(tableEventsFor(events.slice(2), { kind: "player", player: "b" }))
  );
});

test("refuses a second click on the same version and keeps the attempt", async () => {
  const { db, post, version } = await dealtTable();
  const click = { expectedVersion: version, action: { type: "checkOrCall" } };
  expect((await post("/tables/t1/act", "a", click)).status).toBe(200);
  const again = await post("/tables/t1/act", "a", click);
  expect(again.status).toBe(422);
  expect(await again.json()).toEqual({
    violation: {
      code: "stale_version",
      expected: version,
      current: version + 1,
    },
  });
  const attempts = db
    .query<{ rejection: string }, []>("SELECT rejection FROM poker_rejections")
    .all()
    .map(({ rejection }) => JSON.parse(rejection).attempt);
  expect(attempts).toEqual([{ type: "act", player: "a", ...click }]);
});

test("acts as the authenticated player, not the one the body names", async () => {
  const { post, version } = await dealtTable();
  const response = await post("/tables/t1/act", "b", {
    expectedVersion: version,
    action: { type: "fold", player: "a" },
  });
  expect(await response.json()).toMatchObject({
    violation: { code: "not_eligible", player: "b" },
  });
});

test("refuses dealer steps and requests without a player", async () => {
  const { post, version } = await dealtTable();
  const dealBoard = await post("/tables/t1/act", "a", {
    expectedVersion: version,
    action: { type: "dealBoard", cards: ["As", "Ks", "Qs"] },
  });
  expect(dealBoard.status).toBe(400);
  expect((await post("/tables/t1/leave", null)).status).toBe(401);
});
