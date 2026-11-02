import * as z from "zod/mini";

import {
  act,
  startHand,
  type Hand,
  type SetupError,
  type Violation,
} from "./hand.ts";
import { stateOf } from "./hand/state.ts";
import { err, ok, type Result } from "./result.ts";
import {
  handEventSchema,
  handSetupSchema,
  tableCommandSchema,
  tableSetupSchema,
} from "./schemas.ts";
import {
  actAtTable,
  createTable,
  tableStateOf,
  type Table,
  type TableSetupError,
  type TableViolation,
} from "./table.ts";

const storedHandSchema = z.object({
  format: z.literal(1),
  setup: handSetupSchema,
  events: z.readonly(z.array(handEventSchema)),
});

type StoredHand = z.output<typeof storedHandSchema>;

/** Auditor data: the whole deck and every hole card. Never send it to a client. */
export function serializeHand(hand: Hand): string {
  const state = stateOf(hand);
  const stored = {
    format: 1,
    setup: {
      game: state.game,
      players: state.players,
      stacks: state.startingStacks,
      deck: state.startingDeck,
      automate: state.automate,
    },
    events: state.events,
  } satisfies StoredHand;
  return JSON.stringify(stored);
}

type FormatError =
  | { readonly code: "invalid_json" }
  /** `path` locates the first field that does not parse, e.g. `events.3.body`. */
  | {
      readonly code: "invalid_format";
      readonly path: string;
      readonly message: string;
    };

export type HandParseError =
  | FormatError
  | { readonly code: "setup"; readonly error: SetupError }
  | {
      readonly code: "rejected";
      readonly seq: number;
      readonly violation: Violation;
    }
  /** Replaying the actions did not give the stored event with this `seq`. */
  | { readonly code: "mismatch"; readonly seq: number }
  /** The setup parsed but the engine threw playing it, e.g. on 2³² boards. */
  | { readonly code: "unplayable"; readonly cause: unknown };

function parseJson<Stored>(
  schema: z.ZodMiniType<Stored>,
  text: string
): Result<Stored, FormatError> {
  let json: z.core.util.JSONType;
  try {
    json = JSON.parse(text);
  } catch {
    return err({ code: "invalid_json" });
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return ok(parsed.data);
  const [issue] = parsed.error.issues;
  return err({
    code: "invalid_format",
    path: issue?.path.map(String).join(".") ?? "",
    message: issue?.message ?? "",
  });
}

/** Rebuilds the hand by replaying its actions, so it holds only what the engine produced. */
export function parseHand(text: string): Result<Hand, HandParseError> {
  const stored = parseJson(storedHandSchema, text);
  if (!stored.ok) return stored;
  try {
    return replay(stored.value);
  } catch (cause) {
    return err({ code: "unplayable", cause });
  }
}

function replay({ setup, events }: StoredHand): Result<Hand, HandParseError> {
  const started = startHand(setup);
  if (!started.ok) return err({ code: "setup", error: started.error });
  let { hand } = started.value;
  for (const { cause, commentary, seq } of events) {
    if (cause.kind !== "action") continue;
    const options = commentary === null ? {} : { commentary };
    const next = act(hand, cause.action, options);
    if (!next.ok) return err({ code: "rejected", seq, violation: next.error });
    hand = next.value.hand;
  }
  const replayed = stateOf(hand).events;
  const length = Math.max(replayed.length, events.length);
  for (let index = 0; index < length; index += 1) {
    const event = handEventSchema.safeParse(replayed[index]);
    const expected = events[index];
    const same =
      event.success &&
      expected !== undefined &&
      JSON.stringify(event.data) === JSON.stringify(expected);
    if (!same) return err({ code: "mismatch", seq: index + 1 });
  }
  return ok(hand);
}

const storedTableSchema = z.object({
  format: z.literal(1),
  setup: tableSetupSchema,
  commands: z.readonly(z.array(tableCommandSchema)),
});

type StoredTable = z.output<typeof storedTableSchema>;

/** Auditor data: every deck the table dealt. Never send it to a client. */
export function serializeTable(table: Table): string {
  const { setup, commands } = tableStateOf(table);
  return JSON.stringify({ format: 1, setup, commands } satisfies StoredTable);
}

export type TableParseError =
  | FormatError
  | { readonly code: "setup"; readonly error: TableSetupError }
  | {
      readonly code: "rejected";
      readonly index: number;
      readonly violation: TableViolation;
    }
  | { readonly code: "unplayable"; readonly cause: unknown };

/** Rebuilds the table by replaying its commands; the same limits as `parseHand` apply. */
export function parseTable(text: string): Result<Table, TableParseError> {
  const stored = parseJson(storedTableSchema, text);
  if (!stored.ok) return stored;
  try {
    return replayTable(stored.value);
  } catch (cause) {
    return err({ code: "unplayable", cause });
  }
}

function replayTable({
  setup,
  commands,
}: StoredTable): Result<Table, TableParseError> {
  const created = createTable(setup);
  if (!created.ok) return err({ code: "setup", error: created.error });
  let table = created.value;
  for (const [index, command] of commands.entries()) {
    const next = actAtTable(table, command);
    if (!next.ok) {
      return err({ code: "rejected", index, violation: next.error.violation });
    }
    table = next.value.table;
  }
  return ok(table);
}
