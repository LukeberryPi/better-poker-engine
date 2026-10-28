import { addToStack, type Chips } from "../chips.ts";
import type { EventBody, PlayerAmount } from "../events.ts";
import { err, ok, type Result } from "../result.ts";
import type { Rake } from "../rules.ts";
import { effectiveAnte } from "./forced.ts";
import { pendingPlayer, type Refusal } from "./refusal.ts";
import {
  activeCount,
  at,
  boardCount,
  maxOrNull,
  playerAt,
  positionsOf,
  sum,
  upHandOf,
  type HandState,
  type Position,
  type PotState,
  type SubPot,
} from "./state.ts";

/** pokerkit's `rake`, exactly: basis points of the pot, rounded half to even. */
export function rakePot(amount: Chips, rake: Rake, flopDealt: boolean) {
  if (rake.kind === "none" || (rake.noFlopNoDrop && !flopDealt)) {
    return { raked: 0, unraked: amount };
  }
  const product = BigInt(amount) * BigInt(rake.basisPoints);
  const quotient = product / 10_000n;
  const remainder = product % 10_000n;
  const roundsUp =
    remainder > 5_000n || (remainder === 5_000n && quotient % 2n === 1n);
  const raked = Math.min(
    Number(quotient) + (roundsUp ? 1 : 0),
    rake.cap ?? Infinity
  );
  return { raked, unraked: amount - raked };
}

/** pokerkit's `divmod` for chips: the first share takes the remainder. */
export function splitChips(
  amount: Chips,
  ways: number
): readonly [quotient: Chips, remainder: Chips] {
  return [Math.floor(amount / ways), amount % ways];
}

function sameEligible(a: readonly Position[], b: readonly Position[]): boolean {
  return a.length === b.length && a.every((position, i) => position === b[i]);
}

/** Main pot first; a level only folded players reached stays unclaimed. */
export function potsOf(state: HandState): readonly PotState[] {
  if (state.pots !== null) return state.pots;
  if (sum(state.payoffs) === -sum(state.bets)) return [];
  const positions = positionsOf(state);
  const contributions = positions.map(
    (position) => -at(state.payoffs, position) - at(state.bets, position)
  );
  const pending = positions.map((position) => -at(state.payoffs, position));
  let amount = 0;
  if (!state.game.forcedBets.anteTrimming) {
    for (const position of positions) {
      const ante = effectiveAnte(state, position);
      amount += ante;
      contributions[position] = at(contributions, position) - ante;
      pending[position] = at(pending, position) - ante;
    }
  }
  const flopDealt = state.boards.some((slot) => slot.length > 0);
  const pots: PotState[] = [];
  let previous = 0;
  for (const level of [...new Set(contributions)].sort((a, b) => a - b)) {
    for (const contribution of contributions) {
      if (contribution >= level) amount += level - previous;
    }
    const eligible = positions.filter(
      (position) => at(pending, position) >= level && at(state.active, position)
    );
    let last = pots.at(-1);
    while (last !== undefined && sameEligible(last.eligible, eligible)) {
      amount += last.raked + last.unraked;
      pots.pop();
      last = pots.at(-1);
    }
    if (amount !== 0) {
      pots.push({ ...rakePot(amount, state.game.rake, flopDealt), eligible });
    }
    amount = 0;
    previous = level;
  }
  return pots;
}

export function totalPot(state: HandState): Chips {
  return (
    sum(state.bets) + sum(potsOf(state).map((pot) => pot.raked + pot.unraked))
  );
}

function handTypesInPlay(state: HandState, board: number): number[] {
  return state.game.rules.handTypes.flatMap((_, handType) =>
    positionsOf(state).some(
      (position) => upHandOf(state, position, board, handType) !== null
    )
      ? [handType]
      : []
  );
}

/** Each pot splits evenly over boards, then over hand types anyone made. */
export function beginChipsPushing(state: HandState): void {
  state.street = null;
  const pots = potsOf(state).map((pot) => ({ ...pot }));
  state.pots = pots;
  const subPots: SubPot[] = [];
  const active = activeCount(state);
  for (const [index, pot] of pots.entries()) {
    if (active === 1) {
      subPots.push({
        amount: pot.unraked,
        pot: index,
        board: null,
        handType: null,
      });
      continue;
    }
    if (active === 0) continue;
    const boards = boardCount(state);
    const [perBoard, boardRemainder] = splitChips(pot.unraked, boards);
    for (let board = 0; board < boards; board += 1) {
      const boardAmount = perBoard + (board === 0 ? boardRemainder : 0);
      const handTypes = handTypesInPlay(state, board);
      if (handTypes.length === 0) {
        if (boardAmount > 0) {
          subPots.push({
            amount: boardAmount,
            pot: index,
            board,
            handType: null,
          });
        }
        continue;
      }
      const [perType, typeRemainder] = splitChips(
        boardAmount,
        handTypes.length
      );
      for (const [order, handType] of handTypes.entries()) {
        const amount = perType + (order === 0 ? typeRemainder : 0);
        if (amount > 0) subPots.push({ amount, pot: index, board, handType });
      }
    }
  }
  state.phase = { kind: "chipsPushing", subPots };
}

/** Players with no hand on either side tie, as pokerkit compares `None == None`. */
function winnersOf(
  state: HandState,
  subPot: SubPot,
  pot: PotState
): Position[] {
  if (subPot.board === null)
    return pot.eligible.length === 1 ? [...pot.eligible] : [];
  if (subPot.handType === null) return [];
  const { board, handType } = subPot;
  const hands = pot.eligible.map((position) =>
    upHandOf(state, position, board, handType)
  );
  const best = maxOrNull(hands, (hand) => hand.strength);
  return pot.eligible.filter(
    (_, i) => (hands[i]?.strength ?? null) === (best?.strength ?? null)
  );
}

export function pushChips(state: HandState): Result<EventBody, Refusal> {
  if (state.phase.kind !== "chipsPushing") return err({ code: "not_now" });
  const subPot = state.phase.subPots.shift();
  if (subPot === undefined) return err({ code: "not_now" });
  const pot = at(state.pots ?? [], subPot.pot);
  const winners = winnersOf(state, subPot, pot);
  const awards: PlayerAmount[] = [];
  if (winners.length > 0) {
    pot.unraked -= subPot.amount;
    const [share, remainder] = splitChips(subPot.amount, winners.length);
    for (const [order, position] of winners.entries()) {
      const amount = share + (order === 0 ? remainder : 0);
      state.bets[position] = at(state.bets, position) + amount;
      if (amount > 0)
        awards.push({ player: playerAt(state, position), amount });
    }
  }
  return ok({
    type: "chipsPushed",
    pot: subPot.pot,
    board: subPot.board,
    handType: subPot.handType,
    awards,
    unclaimed: winners.length > 0 ? 0 : subPot.amount,
  });
}

export function beginChipsPulling(state: HandState): void {
  state.phase = {
    kind: "chipsPulling",
    pending: state.bets.map((bet) => bet > 0),
  };
}

export function pullChips(
  state: HandState,
  player: Position | undefined
): Result<EventBody, Refusal> {
  if (state.phase.kind !== "chipsPulling") return err({ code: "not_now" });
  const { pending } = state.phase;
  const position = pendingPlayer(state, pending, player);
  if (!position.ok) return position;
  const amount = at(state.bets, position.value);
  pending[position.value] = false;
  state.bets[position.value] = 0;
  state.stacks[position.value] = addToStack(
    at(state.stacks, position.value),
    amount
  );
  state.payoffs[position.value] = at(state.payoffs, position.value) + amount;
  return ok({
    type: "chipsPulled",
    player: playerAt(state, position.value),
    amount,
  });
}
