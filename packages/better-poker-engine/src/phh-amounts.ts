import type { Chips } from "./chips.ts";
import { err, ok, type Result } from "./result.ts";

/** An amount as a decimal numeral, e.g. `"0.25"`. `parsePhh` returns the
 * canonical form: no trailing zeros, and no sign except on a post bet. */
export type PhhDecimal = `${number}`;

/** Every power of ten that is a safe integer; 100 turns dollars into cents. */
export const amountScales = [
  1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000,
  1_000_000_000, 10_000_000_000, 100_000_000_000, 1_000_000_000_000,
  10_000_000_000_000, 100_000_000_000_000, 1_000_000_000_000_000,
] as const;

export type AmountScale = (typeof amountScales)[number];

/** `not_integral` when scaling leaves a fraction: amounts are never rounded. */
export type ChipsError = {
  readonly code: "not_integral" | "out_of_range";
  readonly amount: PhhDecimal;
  readonly scale: AmountScale;
};

/** `units * 10 ** exponent`; `units` has no trailing zeros unless it is 0. */
type ExactDecimal = { readonly units: bigint; readonly exponent: number };

const decimalNumeral = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/iu;
const radixNumeral = /^0(?:b[01]+|o[0-7]+|x[\da-f]+)$/iu;

/** Reads any finite numeric string `Number(text)` accepts, without rounding. */
function exactDecimal(text: string): ExactDecimal | null {
  const trimmed = text.trim();
  if (radixNumeral.test(trimmed)) return exactDecimal(String(BigInt(trimmed)));
  const match = decimalNumeral.exec(trimmed);
  if (match === null) return null;
  const [, sign = "", whole = "", fraction = "", exponent = "0"] = match;
  if (trimmed !== "" && whole === "" && fraction === "") return null;
  const digits = `${whole}${fraction}`;
  const significant = digits.replace(/0+$/u, "");
  if (significant === "") return { units: 0n, exponent: 0 };
  return {
    units: BigInt(`${sign}${significant}`),
    exponent:
      Number(exponent) - fraction.length + digits.length - significant.length,
  };
}

function canonicalText({ units, exponent }: ExactDecimal): PhhDecimal {
  const sign = units < 0n ? "-" : "";
  const digits = String(units < 0n ? -units : units);
  const padded = digits.padStart(1 - exponent, "0");
  const point = padded.length + Math.min(exponent, 0);
  const fraction = padded.slice(point);
  const whole = `${padded.slice(0, point)}${"0".repeat(Math.max(exponent, 0))}`;
  // SAFETY: an optional minus, digits and an optional fraction form a numeral.
  return `${sign}${whole}${fraction === "" ? "" : `.${fraction}`}` as PhhDecimal;
}

export function canonicalDecimal(text: string): PhhDecimal | null {
  const exact = exactDecimal(text);
  return exact === null ? null : canonicalText(exact);
}

/** Converts an amount to chips at `scale` units per whole amount, exactly:
 * `toChips("0.29", 100)` is 29 and `toChips("0.295", 100)` is `not_integral`. */
export function toChips(
  amount: PhhDecimal,
  scale: AmountScale
): Result<Chips, ChipsError> {
  const exact = exactDecimal(amount);
  const shift = (exact?.exponent ?? 0) + amountScales.indexOf(scale);
  if (exact === null || exact.units < 0n || shift > 15) {
    return err({ code: "out_of_range", amount, scale });
  }
  if (shift < 0) return err({ code: "not_integral", amount, scale });
  const chips = exact.units * 10n ** BigInt(shift);
  return chips > BigInt(Number.MAX_SAFE_INTEGER)
    ? err({ code: "out_of_range", amount, scale })
    : ok(Number(chips));
}

/** `toChips` for a `blinds_or_straddles` entry, where pokerkit reads a negative
 * amount as a post bet: its size converts exactly as `toChips`, then is negated. */
export function toBlindChips(
  amount: PhhDecimal,
  scale: AmountScale
): Result<number, ChipsError> {
  const exact = exactDecimal(amount);
  if (exact === null || exact.units >= 0n) return toChips(amount, scale);
  const size = toChips(canonicalText({ ...exact, units: -exact.units }), scale);
  return size.ok ? ok(-size.value) : err({ ...size.error, amount });
}
