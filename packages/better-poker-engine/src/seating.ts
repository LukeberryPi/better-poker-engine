import type { Chips } from "./chips.ts";
import type { PlayerId } from "./hand.ts";
import { perPosition } from "./hand/setup.ts";
import { err, ok, type Result } from "./result.ts";
import type { Antes, Game } from "./rules.ts";

/** "moving": the button moves to the next player dealt in and nobody owes a blind, as in
 * home games. "dead": the big blind moves one player a hand, so the button or the small
 * blind may be dead and missed blinds are owed, as card rooms rule. */
export type ButtonRule = "moving" | "dead";

/** What a player must post to be dealt in before the big blind reaches them. */
export type Owed = "nothing" | "smallBlind" | "bigBlind" | "bothBlinds";

export type SeatState = {
  readonly player: PlayerId;
  readonly stack: Chips;
  readonly sittingOut: boolean;
  readonly owes: Owed;
  /** Posts what it owes at the next hand rather than waiting for the big blind. */
  readonly posting: boolean;
};

export type BlindSeats = { readonly small: number; readonly big: number };

export type Rotation = {
  /** An empty seat when the button is dead. */
  readonly button: number;
  /** Where the blinds were, small blind dead or not; null under a moving button. */
  readonly blinds: BlindSeats | null;
};

export type SeatingInput = {
  /** Blinds are `[small, big]` under a dead button. */
  readonly game: Game;
  readonly seats: ReadonlyArray<SeatState | null>;
  readonly button: ButtonRule;
  /** The last hand's; null before the first hand. */
  readonly rotation: Rotation | null;
  /** The first hand's button: this seat, or the next player dealt in after it. */
  readonly firstButton: number;
};

export type SeatingPlan = {
  /** The seat at each position, as `startHand` takes players: blinds first, button last. */
  readonly positions: ReadonlyArray<number>;
  /** `input.game` with this hand's blinds and antes on those positions. */
  readonly game: Game;
  readonly rotation: Rotation;
  /** Null when the small blind is dead. */
  readonly smallBlind: number | null;
  readonly bigBlind: number;
  /** Every seat after this hand starts: blinds missed, debts posted. */
  readonly seats: ReadonlyArray<SeatState | null>;
};

export type SeatingError = {
  readonly code: "not_enough_players";
  readonly players: number;
};

/** Seats from `from`, exclusive, clockwise round to `from` itself. */
function clockwise(from: number, count: number): Array<number> {
  return Array.from({ length: count }, (_, step) => (from + 1 + step) % count);
}

/** Whether `seat` comes after `start` and no later than `end`, going clockwise. */
function within(start: number, end: number, seat: number, count: number) {
  const distance = (seat - start + count) % count;
  return distance > 0 && distance <= (end - start + count) % count;
}

function blindsOf(game: Game): readonly [small: number, big: number] {
  const [small = 0, big = 0] = game.forcedBets.blinds;
  return [small, big];
}

function antesFor(
  antes: Antes,
  count: number,
  bigBlind: number
): Array<number> {
  switch (antes.kind) {
    case "none":
      return perPosition([], count);
    case "everyone":
      return perPosition(
        Array.from({ length: count }, (_, position) => [
          position,
          antes.amount,
        ]),
        count
      );
    case "button":
      return perPosition([[count - 1, antes.amount]], count);
    case "bigBlind":
      return perPosition([[bigBlind, antes.amount]], count);
    case "byPosition":
      return perPosition(antes.amounts.entries(), count);
  }
}

function settled(seat: SeatState): SeatState {
  return { ...seat, owes: "nothing", posting: false };
}

/** Only a newcomer can owe the big blind when the small blind passes them, and a newcomer
 * owes the big blind alone, as card rooms charge new players. */
function owingAlso(owes: Owed, blind: "smallBlind" | "bigBlind"): Owed {
  if (owes === "nothing" || owes === blind) return blind;
  if (owes === "bigBlind") return owes;
  return "bothBlinds";
}

type Layout = {
  readonly positions: ReadonlyArray<number>;
  readonly game: Game;
  readonly rotation: Rotation;
  readonly smallBlind: number | null;
  readonly bigBlind: number;
};

/** Heads-up, pokerkit seats the big blind first, then the button, who posts the small one. */
function headsUp(
  input: SeatingInput,
  bigBlind: number,
  button: number
): Layout {
  return {
    positions: [bigBlind, button],
    game: input.game,
    rotation: {
      button,
      blinds: input.button === "dead" ? { small: button, big: bigBlind } : null,
    },
    smallBlind: button,
    bigBlind,
  };
}

/** Every player who can play is dealt in, owing nothing, with the button on `button`. */
function restart(
  input: SeatingInput,
  playable: ReadonlyArray<number>,
  button: number
): Layout {
  const count = input.seats.length;
  const after = clockwise(button, count).filter(
    (seat) => seat !== button && playable.includes(seat)
  );
  const [smallBlind = button, bigBlind = button] = after;
  if (after.length === 1) return headsUp(input, smallBlind, button);
  return {
    positions: [...after, button],
    game: input.game,
    rotation: {
      button,
      blinds:
        input.button === "dead" ? { small: smallBlind, big: bigBlind } : null,
    },
    smallBlind,
    bigBlind,
  };
}

function deadButton(
  input: SeatingInput,
  playable: ReadonlyArray<number>,
  last: BlindSeats
): Layout | null {
  const { seats, game } = input;
  const count = seats.length;
  const bigBlind = clockwise(last.big, count).find((seat) =>
    playable.includes(seat)
  );
  if (bigBlind === undefined) return null;
  const smallSeat = last.big;
  // Back from heads-up the button sat on the small blind; it goes just behind it.
  const button =
    last.small === bigBlind ? (smallSeat - 1 + count) % count : last.small;
  const owing = (seat: number) => seats[seat]?.owes !== "nothing";
  const smallLive =
    smallSeat !== bigBlind && playable.includes(smallSeat) && !owing(smallSeat);
  const dealt = playable.filter(
    (seat) =>
      seat === bigBlind ||
      (seat === smallSeat && smallLive) ||
      (seat !== smallSeat &&
        within(bigBlind, button, seat, count) &&
        (!owing(seat) || (seats[seat]?.posting === true && seat !== button)))
  );
  if (dealt.length < 2) return null;
  if (dealt.length === 2) {
    return headsUp(
      input,
      bigBlind,
      dealt.find((seat) => seat !== bigBlind) ?? bigBlind
    );
  }
  const positions = clockwise(button, count).filter((seat) =>
    dealt.includes(seat)
  );
  const position = (seat: number) => positions.indexOf(seat);
  const [small, big] = blindsOf(game);
  const posted = positions.flatMap((seat) => {
    const owes = seats[seat]?.owes;
    return seat !== bigBlind && (owes === "bigBlind" || owes === "bothBlinds")
      ? [[position(seat), -big] as const]
      : [];
  });
  const blinds = perPosition(
    [
      [position(bigBlind), big],
      ...(smallLive ? [[position(smallSeat), small] as const] : []),
      ...posted,
    ],
    positions.length
  );
  const antes = antesFor(
    game.forcedBets.antes,
    positions.length,
    position(bigBlind)
  ).map((ante, index) => {
    const seat = positions[index] ?? bigBlind;
    const owes = seats[seat]?.owes;
    return seat !== bigBlind && (owes === "smallBlind" || owes === "bothBlinds")
      ? ante + small
      : ante;
  });
  return {
    positions,
    game: {
      ...game,
      forcedBets: {
        ...game.forcedBets,
        blinds,
        antes: { kind: "byPosition", amounts: antes },
      },
    },
    rotation: { button, blinds: { small: smallSeat, big: bigBlind } },
    smallBlind: smallLive ? smallSeat : null,
    bigBlind,
  };
}

/** Who plays the next hand, in which positions and for which blinds: the session rules a
 * hand leaves to its table, as data a server can run without the table module. */
export function planHand(
  input: SeatingInput
): Result<SeatingPlan, SeatingError> {
  const { seats, rotation } = input;
  const count = seats.length;
  const playable = seats.flatMap((seat, index) =>
    seat !== null && seat.stack > 0 && !seat.sittingOut ? [index] : []
  );
  if (playable.length < 2) {
    return err({ code: "not_enough_players", players: playable.length });
  }
  const last = rotation?.blinds ?? null;
  const planned =
    input.button === "dead" && rotation !== null && last !== null
      ? deadButton(input, playable, last)
      : null;
  const layout =
    planned ??
    restart(
      input,
      playable,
      rotation === null
        ? (clockwise(input.firstButton - 1, count).find((seat) =>
            playable.includes(seat)
          ) ?? input.firstButton)
        : (clockwise(rotation.button, count).find((seat) =>
            playable.includes(seat)
          ) ?? rotation.button)
    );
  // A seat the blinds pass while it can't play owes them: sitting out, or busted at a rebuy.
  const charged = planned === null || last === null ? null : last;
  const missedBig = new Set(
    charged === null
      ? []
      : clockwise(charged.big, count).filter(
          (seat) =>
            within(charged.big, layout.bigBlind, seat, count) &&
            seat !== layout.bigBlind
        )
  );
  const missedSmall = charged?.big ?? null;
  return ok({
    ...layout,
    seats: seats.map((seat, index) => {
      if (seat === null) return null;
      if (layout.positions.includes(index)) return settled(seat);
      if (playable.includes(index)) return seat;
      if (missedBig.has(index)) {
        return { ...seat, owes: owingAlso(seat.owes, "bigBlind") };
      }
      return index === missedSmall
        ? { ...seat, owes: owingAlso(seat.owes, "smallBlind") }
        : seat;
    }),
  });
}
