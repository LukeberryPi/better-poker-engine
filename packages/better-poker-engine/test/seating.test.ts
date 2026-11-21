import { describe, expect, test } from "bun:test";

import { decks } from "../src/cards.ts";
import { automation, startHand } from "../src/hand.ts";
import { insecureSeededRandom, randomBelow } from "../src/random.ts";
import { holdem } from "../src/rules.ts";
import { planHand } from "../src/seating.ts";
import type {
  ButtonRule,
  Owed,
  Rotation,
  SeatState,
  SeatingPlan,
} from "../src/seating.ts";
import { okValue } from "./support.ts";

const game = holdem.noLimit({ blinds: [50, 100], minBet: 100 });

function seated(player: string, owes: Owed = "nothing"): SeatState {
  return { player, stack: 1000, sittingOut: false, owes, posting: false };
}

function table(
  ...players: ReadonlyArray<string | null>
): Array<SeatState | null> {
  return players.map((player) => (player === null ? null : seated(player)));
}

/** Plays `hands` planned hands on, applying `change` to the seats before each. */
function advance(
  start: SeatingPlan,
  hands: number,
  change: (
    seats: Array<SeatState | null>,
    hand: number
  ) => Array<SeatState | null>
): Array<SeatingPlan> {
  const plans: Array<SeatingPlan> = [];
  let last = start;
  for (let hand = 0; hand < hands; hand += 1) {
    const seats = change([...last.seats], hand);
    last = plan(seats, last.rotation);
    plans.push(last);
  }
  return plans;
}

function plan(
  seats: ReadonlyArray<SeatState | null>,
  rotation: Rotation | null,
  button: ButtonRule = "dead",
  firstButton = 0
): SeatingPlan {
  return okValue(planHand({ game, seats, button, rotation, firstButton }));
}

/** What the engine posts for this plan: [seat, blind] per poster, and dead money. */
function posts(seats: ReadonlyArray<SeatState | null>, planned: SeatingPlan) {
  const started = okValue(
    startHand({
      game: planned.game,
      players: planned.positions.map((seat) => seats[seat]?.player ?? "?"),
      stacks: planned.positions.map((seat) => seats[seat]?.stack ?? 0),
      deck: decks.standard,
      automate: automation.all,
    })
  );
  return started.events.flatMap(({ body }) =>
    body.type === "blindPosted" || body.type === "antePosted"
      ? [[body.type, body.player, body.amount]]
      : []
  );
}

const four = table("a", "b", "c", "d");

describe("planHand, first hand", () => {
  test("puts the button on the given seat, or the next player after it", () => {
    expect(plan(four, null, "dead", 2).positions).toEqual([3, 0, 1, 2]);
    const gap = table("a", null, "c", "d");
    expect(plan(gap, null, "dead", 1).rotation.button).toBe(2);
  });

  test("seats heads-up players big blind first, then the button on the small blind", () => {
    const two = table("a", "b");
    const planned = plan(two, null, "dead", 0);
    expect(planned.positions).toEqual([1, 0]);
    expect([planned.smallBlind, planned.bigBlind]).toEqual([0, 1]);
    expect(posts(two, planned)).toEqual([
      ["blindPosted", "b", 100],
      ["blindPosted", "a", 50],
    ]);
  });
});

describe("planHand, moving button", () => {
  test("moves the button to the next player and deals everyone in free", () => {
    const first = plan(four, null, "moving", 0);
    const next = plan(
      [...four.slice(0, 3), seated("e", "bigBlind")],
      first.rotation,
      "moving"
    );
    expect(next.rotation).toEqual({ button: 1, blinds: null });
    expect(next.positions).toEqual([2, 3, 0, 1]);
  });
});

describe("planHand, dead button", () => {
  const first = plan(four, null, "dead", 0);

  test("moves the big blind one player a hand, the small blind and button behind it", () => {
    const next = plan(four, first.rotation);
    expect(next.rotation).toEqual({ button: 1, blinds: { small: 2, big: 3 } });
    expect(next.positions).toEqual([2, 3, 0, 1]);
  });

  test("leaves the small blind dead when last hand's big blind is gone", () => {
    const gone = table("a", "b", null, "d");
    const next = plan(gone, first.rotation);
    expect([next.smallBlind, next.bigBlind]).toEqual([null, 3]);
    expect(next.positions).toEqual([3, 0, 1]);
    expect(posts(gone, next)).toEqual([["blindPosted", "d", 100]]);
  });

  test("leaves the button dead when last hand's small blind is gone", () => {
    const gone = table("a", null, "c", "d");
    const next = plan(gone, first.rotation);
    expect(next.rotation.button).toBe(1);
    expect(next.positions).toEqual([2, 3, 0]);
  });

  test("deals a new player in when the big blind reaches them", () => {
    const joined = [...four.slice(0, 3), seated("e", "bigBlind")];
    const next = plan(joined, first.rotation);
    expect(next.bigBlind).toBe(3);
    expect(next.seats[3]?.owes).toBe("nothing");
  });

  test("makes a new player wait, or post a live big blind, between the big blind and the button", () => {
    const five = [...four, seated("e", "bigBlind")];
    const waiting = plan(five, first.rotation);
    expect(waiting.positions).not.toContain(4);
    expect(waiting.seats[4]?.owes).toBe("bigBlind");
    const posting = five.with(4, { ...seated("e", "bigBlind"), posting: true });
    const posted = plan(posting, first.rotation);
    expect(posted.positions).toEqual([2, 3, 4, 0, 1]);
    expect(posts(posting, posted)).toEqual([
      ["blindPosted", "c", 50],
      ["blindPosted", "d", 100],
      ["blindPosted", "e", 100],
    ]);
  });

  test("never lets a poster in on the button", () => {
    const onButton = [
      seated("a"),
      { ...seated("e", "bigBlind"), posting: true },
      seated("c"),
      seated("d"),
    ];
    const next = plan(onButton, first.rotation);
    expect(next.positions).not.toContain(1);
  });

  test("charges a big blind missed while away, posted live on return", () => {
    const away = advance(first, 3, (seats, hand) =>
      hand === 0 ? seats.with(0, { ...seated("a"), sittingOut: true }) : seats
    );
    expect(away.map((next) => next.seats[0]?.owes)).toEqual([
      "nothing",
      "bigBlind",
      "bigBlind",
    ]);
    const last = away.at(-1) ?? first;
    const back = last.seats.with(0, {
      ...seated("a", "bigBlind"),
      posting: true,
    });
    const posted = plan(back, last.rotation);
    expect(posted.positions).toContain(0);
    expect(posts(back, posted)).toContainEqual(["blindPosted", "a", 100]);
    expect(posted.seats[0]?.owes).toBe("nothing");
  });

  test("charges a small blind missed right after the big blind, posted dead", () => {
    const plans = advance(first, 3, (seats, hand) => {
      const c = seats[2];
      if (c === null || c === undefined) {
        return seats;
      }
      if (hand === 0) {
        return seats.with(2, { ...c, sittingOut: true });
      }
      if (hand === 1) {
        return seats.with(2, { ...c, sittingOut: false, posting: true });
      }
      return seats;
    });
    expect(plans[0]?.seats[2]?.owes).toBe("smallBlind");
    const dealt = plans.find((next) => next.positions.includes(2));
    expect(dealt === undefined ? [] : posts(dealt.seats, dealt)).toContainEqual(
      ["antePosted", "c", 50]
    );
  });
});

describe("planHand, missed blinds", () => {
  test("charges a busted player the big blind the table plays past", () => {
    const first = plan(four, null, "dead", 0);
    const busted = four.with(3, { ...seated("d"), stack: 0 });
    const next = plan(busted, first.rotation);
    expect(next.bigBlind).toBe(0);
    expect(next.seats[3]?.owes).toBe("bigBlind");
  });

  test("charges a newcomer who sits out in last hand's big blind seat the big blind only", () => {
    const first = plan(four, null, "dead", 0);
    const newcomer = four.with(2, {
      ...seated("e", "bigBlind"),
      sittingOut: true,
    });
    const next = plan(newcomer, first.rotation);
    expect(next.smallBlind).toBe(null);
    expect(next.seats[2]?.owes).toBe("bigBlind");
  });

  test("charges the small blind to a sitting-out big blind when the table drops to heads-up", () => {
    const first = plan(four, null, "dead", 0);
    const two = four
      .with(2, { ...seated("c"), sittingOut: true })
      .with(3, null);
    const next = plan(two, first.rotation);
    expect(next.positions).toEqual([0, 1]);
    expect(next.seats[2]?.owes).toBe("smallBlind");
  });
});

describe("planHand, heads-up", () => {
  test("from three to two, nobody posts the big blind twice in a row", () => {
    const three = table("a", "b", "c");
    const first = plan(three, null, "dead", 0);
    for (const leaver of [0, 1, 2]) {
      const two = three.with(leaver, null);
      const next = plan(two, first.rotation);
      expect(next.positions).toHaveLength(2);
      expect(next.bigBlind).not.toBe(first.bigBlind);
    }
  });

  test("from two to three, a new player gets in by the big blind", () => {
    const two = table("a", null, "b");
    const first = plan(two, null, "dead", 0);
    let rotation = first.rotation;
    let seats = two.with(1, seated("c", "bigBlind"));
    const bigBlinds: Array<number> = [first.bigBlind];
    for (let hand = 0; hand < 3; hand += 1) {
      const next = plan(seats, rotation);
      bigBlinds.push(next.bigBlind);
      rotation = next.rotation;
      seats = [...next.seats];
    }
    expect(bigBlinds.slice(1)).toContain(1);
    expect(bigBlinds.every((seat, hand) => seat !== bigBlinds[hand - 1])).toBe(
      true
    );
  });
});

describe("planHand over random sessions", () => {
  test("deals the big blind in, never twice running, and starts every planned hand", () => {
    const random = insecureSeededRandom(19);
    const problems: Array<string> = [];
    for (let session = 0; session < 300; session += 1) {
      let seats: Array<SeatState | null> = Array.from(
        { length: 6 },
        (_, seat) => (randomBelow(3, random) === 0 ? null : seated(`p${seat}`))
      );
      let rotation: Rotation | null = null;
      let lastBigBlind: string | null = null;
      for (let hand = 0; hand < 40; hand += 1) {
        const seat = randomBelow(6, random);
        const occupant = seats[seat];
        const change = randomBelow(6, random);
        if (occupant === null || occupant === undefined) {
          if (change === 0) {
            seats = seats.with(seat, seated(`n${session}-${hand}`, "bigBlind"));
          }
        } else if (change === 0) {
          seats = seats.with(seat, null);
        } else if (change === 1) {
          seats = seats.with(seat, {
            ...occupant,
            sittingOut: !occupant.sittingOut,
          });
        } else if (change === 2 && occupant.owes !== "nothing") {
          seats = seats.with(seat, { ...occupant, posting: true });
        }
        const planned = planHand({
          game,
          seats,
          button: "dead",
          rotation,
          firstButton: 0,
        });
        if (!planned.ok) {
          continue;
        }
        const { positions, bigBlind } = planned.value;
        const bigBlindPlayer = seats[bigBlind]?.player ?? null;
        if (!positions.includes(bigBlind)) {
          problems.push(`${session}/${hand}: big blind out`);
        }
        if (bigBlindPlayer === lastBigBlind) {
          problems.push(`${session}/${hand}: big blind twice`);
        }
        if (posts(seats, planned.value).length === 0) {
          problems.push(`${session}/${hand}: nothing posted`);
        }
        lastBigBlind = bigBlindPlayer;
        rotation = planned.value.rotation;
        seats = [...planned.value.seats];
      }
    }
    expect(problems).toEqual([]);
  });
});
