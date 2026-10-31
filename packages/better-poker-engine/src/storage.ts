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
import { handEventSchema, handSetupSchema } from "./schemas.ts";

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

export type HandParseError =
  | { readonly code: "invalid_json" }
  /** `path` locates the first field that does not parse, e.g. `events.3.body`. */
  | {
      readonly code: "invalid_format";
      readonly path: string;
      readonly message: string;
    }
  | { readonly code: "setup"; readonly error: SetupError }
  | {
      readonly code: "rejected";
      readonly seq: number;
      readonly violation: Violation;
    }
  /** Replaying the actions did not give the stored event with this `seq`. */
  | { readonly code: "mismatch"; readonly seq: number };

function parseJson(text: string): Result<StoredHand, HandParseError> {
  let json: z.core.util.JSONType;
  try {
    json = JSON.parse(text);
  } catch {
    return err({ code: "invalid_json" });
  }
  const parsed = storedHandSchema.safeParse(json);
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
  const stored = parseJson(text);
  if (!stored.ok) return stored;
  const { setup, events } = stored.value;
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
