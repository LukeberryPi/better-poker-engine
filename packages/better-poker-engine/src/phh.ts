import { TomlDate, type TomlTable, type TomlValue } from "smol-toml";
import * as z from "zod/mini";

import type { Unbounded } from "./chips.ts";
import {
  formatPhhAction,
  parsePhhAction,
  type PhhAction,
} from "./phh-actions.ts";
import { canonicalDecimal, type PhhDecimal } from "./phh-amounts.ts";
import { err, ok, type Result } from "./result.ts";
import {
  isTable,
  readToml,
  tomlArray,
  tomlKey,
  tomlString,
  tomlValue,
  userValueOf,
  type PhhValue,
  type TomlSyntaxError,
} from "./toml.ts";
import { variantCodes, type VariantCode } from "./variants.ts";

export type { PhhAction } from "./phh-actions.ts";
export {
  amountScales,
  toChips,
  type AmountScale,
  type ChipsError,
  type PhhDecimal,
} from "./phh-amounts.ts";
export type { PhhValue } from "./toml.ts";

/** A stack, or `unbounded` where the history writes `inf`. */
export type PhhStack = PhhDecimal | Unbounded;

/** A TOML local time such as `12:34:56`; TOML keeps at least milliseconds. */
export type PhhTime = {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
};

const fixedLimitBlindVariants = ["FT", "FO/8", "F2L3D", "FB"] as const;
const noOrPotLimitBlindVariants = ["NT", "NS", "PO", "N2L1D"] as const;
const studVariants = ["F7S", "F7S/8", "FR"] as const;

type ForcedBets =
  | {
      readonly variant: (typeof fixedLimitBlindVariants)[number];
      readonly blinds: readonly PhhDecimal[];
      readonly bringIn: null;
      readonly smallBet: PhhDecimal;
      readonly bigBet: PhhDecimal;
      readonly minBet: null;
    }
  | {
      readonly variant: (typeof noOrPotLimitBlindVariants)[number];
      readonly blinds: readonly PhhDecimal[];
      readonly bringIn: null;
      readonly smallBet: null;
      readonly bigBet: null;
      readonly minBet: PhhDecimal;
    }
  | {
      readonly variant: (typeof studVariants)[number];
      readonly blinds: null;
      readonly bringIn: PhhDecimal;
      readonly smallBet: PhhDecimal;
      readonly bigBet: PhhDecimal;
      readonly minBet: null;
    };

/** A PHH document (https://phh.readthedocs.io). Fields are the spec's keys in
 * camelCase, `blinds` is `blinds_or_straddles`, and `null` means absent. As in
 * pokerkit, a negative entry in `blinds` is a post bet. */
export type Phh = ForcedBets & {
  readonly anteTrimming: boolean | null;
  readonly antes: readonly PhhDecimal[];
  readonly startingStacks: readonly PhhStack[];
  readonly actions: readonly PhhAction[];
  readonly author: string | null;
  readonly event: string | null;
  readonly url: string | null;
  readonly venue: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly time: PhhTime | null;
  readonly timeZone: string | null;
  readonly timeZoneAbbreviation: string | null;
  readonly day: number | null;
  readonly month: number | null;
  readonly year: number | null;
  readonly hand: number | string | null;
  readonly level: number | null;
  readonly seats: readonly number[] | null;
  readonly seatCount: number | null;
  readonly table: number | string | null;
  readonly players: readonly string[] | null;
  readonly finishingStacks: readonly PhhStack[] | null;
  readonly winnings: readonly PhhDecimal[] | null;
  readonly currency: string | null;
  readonly currencySymbol: string | null;
  readonly timeLimit: PhhStack | null;
  readonly timeBanks: readonly PhhDecimal[] | null;
  /** Fields the spec does not define, by key; the spec asks them to start with `_`. */
  readonly extra: Readonly<Record<string, PhhValue>>;
};

/** `path` names a field as the document writes it, e.g. `starting_stacks[2]`. */
export type PhhIssue = { readonly path: string; readonly message: string };

type DocumentError =
  | { readonly code: "schema"; readonly issues: readonly PhhIssue[] }
  | { readonly code: "unknown_variant"; readonly variant: string }
  | {
      readonly code: "action_syntax";
      readonly index: number;
      readonly text: string;
    };

export type PhhError = TomlSyntaxError | DocumentError;

/** `document` is the failing history's table key, e.g. `"3"` for `[3]`. */
export type PhhsError =
  | TomlSyntaxError
  | (DocumentError & { readonly document: string });

function expected(description: string) {
  return {
    error: (issue: z.core.$ZodRawIssue) =>
      issue.input === undefined ? "missing" : `expected ${description}`,
  };
}

function arrayOf<Item extends z.core.SomeType>(item: Item) {
  return z.array(item, expected("an array"));
}

const text = z.string(expected("a string"));

const decimal = z.transform((value: bigint | number, context) => {
  const amount = canonicalDecimal(String(value));
  if (amount !== null) return amount;
  context.issues.push({
    code: "custom",
    message: "expected a number",
    input: value,
  });
  return z.NEVER;
});

const signedAmount = z.pipe(
  z.union([z.bigint(), z.number()], expected("a number")),
  decimal
);

const amount = z.pipe(
  z
    .union([z.bigint(), z.number()], expected("a non-negative number"))
    .check(z.nonnegative(expected("a non-negative number"))),
  decimal
);

const positiveAmount = z.pipe(
  z
    .union([z.bigint(), z.number()], expected("a positive number"))
    .check(z.positive(expected("a positive number"))),
  decimal
);

const unbounded = z.pipe(
  z.literal(Infinity),
  z.transform((): Unbounded => "unbounded")
);

const positiveStack = z.union(
  [unbounded, positiveAmount],
  expected("a positive number or inf")
);

function integerFrom(minimum: bigint, maximum: bigint) {
  const range = expected(`an integer from ${minimum} to ${maximum}`);
  return z.pipe(
    z.bigint(range).check(z.minimum(minimum, range), z.maximum(maximum, range)),
    z.transform((value) => Number(value))
  );
}

const safeLimit = BigInt(Number.MAX_SAFE_INTEGER);
const integer = integerFrom(-safeLimit, safeLimit);
const label = z.union(
  [text, integer],
  expected(`a string or an integer from ${-safeLimit} to ${safeLimit}`)
);

/** Reads a TOML local time as `TomlDate` writes it, e.g. `12:34:56.789`. */
function localTimeOf(time: string): PhhTime | null {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/u.exec(time);
  if (match === null) return null;
  const [, hour = "", minute = "", second = "", fraction = ""] = match;
  return {
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    millisecond: Number(fraction.slice(0, 3).padEnd(3, "0")),
  };
}

const localTime = z.pipe(
  z
    .instanceof(TomlDate, expected("a local time such as 12:34:56"))
    .check(
      z.refine(
        (date) => date.isTime(),
        expected("a local time such as 12:34:56")
      )
    ),
  z.transform((date, context) => {
    const time = localTimeOf(date.toISOString());
    if (time !== null) return time;
    context.issues.push({
      code: "custom",
      message: "expected a local time",
      input: date,
    });
    return z.NEVER;
  })
);

const commonFields = {
  variant: z.enum(variantCodes),
  ante_trimming_status: z.optional(z.boolean(expected("a boolean"))),
  antes: arrayOf(amount),
  starting_stacks: arrayOf(positiveStack),
  actions: arrayOf(text),
  author: z.optional(text),
  event: z.optional(text),
  url: z.optional(text),
  venue: z.optional(text),
  address: z.optional(text),
  city: z.optional(text),
  region: z.optional(text),
  postal_code: z.optional(text),
  country: z.optional(text),
  time: z.optional(localTime),
  time_zone: z.optional(text),
  time_zone_abbreviation: z.optional(text),
  day: z.optional(integerFrom(1n, 31n)),
  month: z.optional(integerFrom(1n, 12n)),
  year: z.optional(integer),
  hand: z.optional(label),
  level: z.optional(integer),
  seats: z.optional(arrayOf(integer)),
  seat_count: z.optional(integer),
  table: z.optional(label),
  players: z.optional(arrayOf(text)),
  finishing_stacks: z.optional(
    arrayOf(
      z.union([unbounded, amount], expected("a non-negative number or inf"))
    )
  ),
  winnings: z.optional(arrayOf(amount)),
  currency: z.optional(text),
  currency_symbol: z.optional(text),
  time_limit: z.optional(positiveStack),
  time_banks: z.optional(arrayOf(amount)),
};

const standardFields = new Set([
  ...Object.keys(commonFields),
  "blinds_or_straddles",
  "bring_in",
  "small_bet",
  "big_bet",
  "min_bet",
]);

type PlayerArrays = {
  readonly antes: readonly PhhDecimal[];
  readonly blinds_or_straddles?: readonly PhhDecimal[];
  readonly starting_stacks: readonly PhhStack[];
  readonly seats?: readonly number[] | undefined;
  readonly players?: readonly string[] | undefined;
  readonly finishing_stacks?: readonly PhhStack[] | undefined;
  readonly winnings?: readonly PhhDecimal[] | undefined;
  readonly time_banks?: readonly PhhDecimal[] | undefined;
};

const onePerPlayer = z.superRefine((fields: PlayerArrays, context) => {
  const players = fields.starting_stacks.length;
  const arrays = {
    antes: fields.antes,
    blinds_or_straddles: fields.blinds_or_straddles,
    seats: fields.seats,
    players: fields.players,
    finishing_stacks: fields.finishing_stacks,
    winnings: fields.winnings,
    time_banks: fields.time_banks,
  };
  for (const [key, values] of Object.entries(arrays)) {
    if (values === undefined || values.length === players) continue;
    context.issues.push({
      code: "custom",
      path: [key],
      message: `expected ${players} entries, one per player`,
      input: values,
    });
  }
});

const common = z.strictObject(commonFields);

function detailsOf(fields: z.output<typeof common>) {
  return {
    anteTrimming: fields.ante_trimming_status ?? null,
    antes: fields.antes,
    startingStacks: fields.starting_stacks,
    actions: fields.actions,
    author: fields.author ?? null,
    event: fields.event ?? null,
    url: fields.url ?? null,
    venue: fields.venue ?? null,
    address: fields.address ?? null,
    city: fields.city ?? null,
    region: fields.region ?? null,
    postalCode: fields.postal_code ?? null,
    country: fields.country ?? null,
    time: fields.time ?? null,
    timeZone: fields.time_zone ?? null,
    timeZoneAbbreviation: fields.time_zone_abbreviation ?? null,
    day: fields.day ?? null,
    month: fields.month ?? null,
    year: fields.year ?? null,
    hand: fields.hand ?? null,
    level: fields.level ?? null,
    seats: fields.seats ?? null,
    seatCount: fields.seat_count ?? null,
    table: fields.table ?? null,
    players: fields.players ?? null,
    finishingStacks: fields.finishing_stacks ?? null,
    winnings: fields.winnings ?? null,
    currency: fields.currency ?? null,
    currencySymbol: fields.currency_symbol ?? null,
    timeLimit: fields.time_limit ?? null,
    timeBanks: fields.time_banks ?? null,
  };
}

const fixedLimitBlinds = z.pipe(
  z
    .extend(common, {
      variant: z.enum(fixedLimitBlindVariants),
      blinds_or_straddles: arrayOf(signedAmount),
      small_bet: positiveAmount,
      big_bet: positiveAmount,
    })
    .check(onePerPlayer),
  z.transform((fields) => ({
    ...detailsOf(fields),
    variant: fields.variant,
    blinds: fields.blinds_or_straddles,
    bringIn: null,
    smallBet: fields.small_bet,
    bigBet: fields.big_bet,
    minBet: null,
  }))
);

const noOrPotLimitBlinds = z.pipe(
  z
    .extend(common, {
      variant: z.enum(noOrPotLimitBlindVariants),
      blinds_or_straddles: arrayOf(signedAmount),
      min_bet: positiveAmount,
    })
    .check(onePerPlayer),
  z.transform((fields) => ({
    ...detailsOf(fields),
    variant: fields.variant,
    blinds: fields.blinds_or_straddles,
    bringIn: null,
    smallBet: null,
    bigBet: null,
    minBet: fields.min_bet,
  }))
);

const fixedLimitStud = z.pipe(
  z
    .extend(common, {
      variant: z.enum(studVariants),
      bring_in: positiveAmount,
      small_bet: positiveAmount,
      big_bet: positiveAmount,
    })
    .check(onePerPlayer),
  z.transform((fields) => ({
    ...detailsOf(fields),
    variant: fields.variant,
    blinds: null,
    bringIn: fields.bring_in,
    smallBet: fields.small_bet,
    bigBet: fields.big_bet,
    minBet: null,
  }))
);

const historySchemas = {
  FT: fixedLimitBlinds,
  NT: noOrPotLimitBlinds,
  NS: noOrPotLimitBlinds,
  PO: noOrPotLimitBlinds,
  "FO/8": fixedLimitBlinds,
  F7S: fixedLimitStud,
  "F7S/8": fixedLimitStud,
  FR: fixedLimitStud,
  N2L1D: noOrPotLimitBlinds,
  F2L3D: fixedLimitBlinds,
  FB: fixedLimitBlinds,
} satisfies Record<VariantCode, z.core.SomeType>;

function pathOf(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) =>
      Number.isInteger(key)
        ? `[${String(key)}]`
        : `${index === 0 ? "" : "."}${String(key)}`
    )
    .join("");
}

function schemaError(
  issues: readonly z.core.$ZodIssue[],
  variant: VariantCode
): DocumentError {
  return {
    code: "schema",
    issues: issues.flatMap((issue) =>
      issue.code === "unrecognized_keys"
        ? issue.keys.map((key) => ({
            path: key,
            message: `not a field of ${variant} histories`,
          }))
        : [{ path: pathOf(issue.path), message: issue.message }]
    ),
  };
}

function variantOf(
  value: TomlValue | undefined
): Result<VariantCode, DocumentError> {
  const name = z.string().safeParse(value);
  if (!name.success) {
    const message = value === undefined ? "missing" : "expected a string";
    return err({ code: "schema", issues: [{ path: "variant", message }] });
  }
  const variant = variantCodes.find((code) => code === name.data);
  return variant === undefined
    ? err({ code: "unknown_variant", variant: name.data })
    : ok(variant);
}

function actionsOf(
  texts: readonly string[]
): Result<readonly PhhAction[], DocumentError> {
  const actions: PhhAction[] = [];
  for (const [index, text] of texts.entries()) {
    const action = parsePhhAction(text);
    if (action === null) return err({ code: "action_syntax", index, text });
    actions.push(action);
  }
  return ok(actions);
}

function historyFrom(table: TomlTable): Result<Phh, DocumentError> {
  const variant = variantOf(table["variant"]);
  if (!variant.ok) return variant;
  const entries = Object.entries(table);
  const fields = historySchemas[variant.value].safeParse(
    Object.fromEntries(entries.filter(([key]) => standardFields.has(key)))
  );
  if (!fields.success) {
    return err(schemaError(fields.error.issues, variant.value));
  }
  const actions = actionsOf(fields.data.actions);
  if (!actions.ok) return actions;
  const extra = entries
    .filter(([key]) => !standardFields.has(key))
    .map(([key, value]) => [key, userValueOf(value)] as const);
  return ok({
    ...fields.data,
    actions: actions.value,
    extra: Object.fromEntries(extra),
  });
}

/** Reads one `.phh` document. Unknown fields are kept in `extra`, with or
 * without the `_` the spec asks for, so that `formatPhh` writes them back. */
export function parsePhh(text: string): Result<Phh, PhhError> {
  const table = readToml(text);
  return table.ok ? historyFrom(table.value) : table;
}

/** Reads a `.phhs` file: a table of histories such as `[1]`, `[2]`, in order. */
export function parsePhhs(text: string): Result<readonly Phh[], PhhsError> {
  const table = readToml(text);
  if (!table.ok) return table;
  const histories: Phh[] = [];
  for (const [document, value] of Object.entries(table.value)) {
    const history: Result<Phh, DocumentError> = isTable(value)
      ? historyFrom(value)
      : err({
          code: "schema",
          issues: [{ path: "", message: "expected a table" }],
        });
    if (!history.ok) return err({ ...history.error, document });
    histories.push(history.value);
  }
  return ok(histories);
}

function decimalText(value: PhhDecimal): string {
  return canonicalDecimal(value) ?? value;
}

function stackText(value: PhhStack): string {
  return value === "unbounded" ? "inf" : decimalText(value);
}

function labelText(value: number | string): string {
  return String(value) === value ? tomlString(value) : String(value);
}

function timeText(time: PhhTime): string {
  const clock = [time.hour, time.minute, time.second]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  return time.millisecond === 0
    ? clock
    : `${clock}.${String(time.millisecond).padStart(3, "0")}`;
}

function listOf<Item>(write: (item: Item) => string) {
  return (items: readonly Item[]) => tomlArray(items.map(write));
}

function line<Value>(
  key: string,
  value: Value | null,
  write: (value: Value) => string
): readonly string[] {
  return value === null ? [] : [`${key} = ${write(value)}`];
}

/** Writes fields in pokerkit's `HandHistory.dumps` order, user fields last,
 * without a trailing newline, so pokerkit's own files round-trip byte for byte. */
export function formatPhh(history: Phh): string {
  return [
    ...line("variant", history.variant, tomlString),
    ...line("ante_trimming_status", history.anteTrimming, String),
    ...line("antes", history.antes, listOf(decimalText)),
    ...line("blinds_or_straddles", history.blinds, listOf(decimalText)),
    ...line("bring_in", history.bringIn, decimalText),
    ...line("small_bet", history.smallBet, decimalText),
    ...line("big_bet", history.bigBet, decimalText),
    ...line("min_bet", history.minBet, decimalText),
    ...line("starting_stacks", history.startingStacks, listOf(stackText)),
    ...line(
      "actions",
      history.actions,
      listOf((action: PhhAction) => tomlString(formatPhhAction(action)))
    ),
    ...line("author", history.author, tomlString),
    ...line("event", history.event, tomlString),
    ...line("url", history.url, tomlString),
    ...line("venue", history.venue, tomlString),
    ...line("address", history.address, tomlString),
    ...line("city", history.city, tomlString),
    ...line("region", history.region, tomlString),
    ...line("postal_code", history.postalCode, tomlString),
    ...line("country", history.country, tomlString),
    ...line("time", history.time, timeText),
    ...line("time_zone", history.timeZone, tomlString),
    ...line("time_zone_abbreviation", history.timeZoneAbbreviation, tomlString),
    ...line("day", history.day, String),
    ...line("month", history.month, String),
    ...line("year", history.year, String),
    ...line("hand", history.hand, labelText),
    ...line("level", history.level, String),
    ...line(
      "seats",
      history.seats,
      listOf((seat: number) => String(seat))
    ),
    ...line("seat_count", history.seatCount, String),
    ...line("table", history.table, labelText),
    ...line("players", history.players, listOf(tomlString)),
    ...line("finishing_stacks", history.finishingStacks, listOf(stackText)),
    ...line("winnings", history.winnings, listOf(decimalText)),
    ...line("currency", history.currency, tomlString),
    ...line("currency_symbol", history.currencySymbol, tomlString),
    ...line("time_limit", history.timeLimit, stackText),
    ...line("time_banks", history.timeBanks, listOf(decimalText)),
    ...Object.entries(history.extra).map(
      ([key, value]) => `${tomlKey(key)} = ${tomlValue(value)}`
    ),
  ].join("\n");
}

/** Writes histories as pokerkit's `HandHistory.dumps_all` does: `[1]`, `[2]`, ... */
export function formatPhhs(histories: readonly Phh[]): string {
  return histories
    .map((history, index) => `[${index + 1}]\n${formatPhh(history)}`)
    .join("\n\n");
}
