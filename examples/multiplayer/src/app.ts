import {
  actAtTable,
  createTable,
  decks,
  holdem,
  playerActionSchema,
  secureRandom,
  shuffle,
  tableEventsFor,
  viewTable,
  type Audience,
  type PlayerId,
  type RandomSource,
  type TableCommand,
} from "better-poker-engine";
import type { TableStore } from "better-poker-engine/sqlite";
import { Hono, type Context } from "hono";
import * as z from "zod/mini";

const game = holdem.noLimit({ blinds: [1, 2], minBet: 2 });

const joinBody = z.object({ seat: z.number(), stack: z.number() });
const actBody = z.object({
  expectedVersion: z.number(),
  action: playerActionSchema,
});
const afterQuery = z.optional(z.coerce.number());

/** Stands in for real authentication, such as a session cookie. */
function playerOf(c: Context): PlayerId | null {
  return c.req.header("x-player") ?? null;
}

function audienceOf(player: PlayerId | null): Audience {
  return player === null ? { kind: "spectator" } : { kind: "player", player };
}

async function bodyOf(c: Context): Promise<z.core.util.JSONType | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

export function createApp(
  store: TableStore,
  random: RandomSource = secureRandom()
) {
  const app = new Hono();

  async function send(c: Context, command: (player: PlayerId) => TableCommand) {
    const id = c.req.param("id") ?? "";
    const player = playerOf(c);
    if (player === null) return c.json({ error: "unauthenticated" }, 401);
    const table = await store.loadTable(id);
    if (table === null) return c.json({ error: "no_table" }, 404);
    const result = actAtTable(table, command(player));
    if (!result.ok) {
      await store.saveRejection(id, table, result.error);
      return c.json({ violation: result.error.violation }, 422);
    }
    const saved = await store.saveTransition(id, result.value);
    if (!saved.ok) return c.json({ error: saved.error.code }, 409);
    return c.json(viewTable(result.value.table, audienceOf(player)));
  }

  app.post("/tables/:id", async (c) => {
    const created = createTable({ game, seats: 6 });
    if (!created.ok) return c.json({ error: created.error }, 500);
    const inserted = await store.insertTable(c.req.param("id"), created.value);
    if (!inserted.ok) return c.json({ error: inserted.error.code }, 409);
    return c.json(viewTable(created.value, audienceOf(playerOf(c))), 201);
  });

  app.get("/tables/:id", async (c) => {
    const table = await store.loadTable(c.req.param("id"));
    if (table === null) return c.json({ error: "no_table" }, 404);
    return c.json(viewTable(table, audienceOf(playerOf(c))));
  });

  app.get("/tables/:id/events", async (c) => {
    const after = afterQuery.safeParse(c.req.query("after"));
    if (!after.success) return c.json({ error: "invalid_after" }, 400);
    const events = await store.events(c.req.param("id"), after.data);
    return c.json(tableEventsFor(events, audienceOf(playerOf(c))));
  });

  app.post("/tables/:id/join", async (c) => {
    const body = joinBody.safeParse(await bodyOf(c));
    if (!body.success) return c.json({ error: "invalid_body" }, 400);
    return send(c, (player) => ({ type: "join", player, ...body.data }));
  });

  app.post("/tables/:id/leave", (c) =>
    send(c, (player) => ({ type: "leave", player }))
  );

  app.post("/tables/:id/deal", (c) =>
    send(c, () => ({
      type: "startHand",
      deck: shuffle(decks.standard, random),
    }))
  );

  app.post("/tables/:id/act", async (c) => {
    const body = actBody.safeParse(await bodyOf(c));
    if (!body.success) return c.json({ error: "invalid_body" }, 400);
    return send(c, (player) => ({ type: "act", player, ...body.data }));
  });

  return app;
}
