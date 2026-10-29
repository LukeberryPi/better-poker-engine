import { expect } from "bun:test";

import { unitTest } from "../../../../parity/harness.ts";
import { automation, type Hand } from "../../src/hand.ts";
import { draw, holdem, omaha, stud } from "../../src/rules.ts";
import {
  drive,
  moves,
  play,
  repeat,
  stacks,
  start,
  totalPot,
} from "../driver.ts";
import { dealer, deck, discard, replaysWithout } from "./wsop.ts";

const { call, fold, raise, raiseTo, bringIn, standPat } = moves;
const {
  postAnte,
  collectBets,
  postBlind,
  dealHole,
  burnCard,
  dealBoard,
  showOrMuck,
  killHand,
  pushChips,
  pullChips,
} = dealer;

function replaysTheSameHand(hand: Hand): void {
  replaysWithout(hand, ["holeDealt", "runoutCountSelected"]);
}

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_1_00_02_07",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 120000] },
      blinds: [40000, 80000],
      minBet: 80000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [7380000, 2500000, 5110000, 10170000, 4545000],
        automation.none,
        deck(
          "   7s Js Td 6d Qh",
          "   4s 8h 8c 5h 7h",
          "?? JcTs2d",
          "?? As",
          "?? Qs"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(240000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raiseTo(170000),
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(500000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(140000),
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(780000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(325000),
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1430000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(600000),
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2630000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      7340000, 3775000, 5110000, 8935000, 4545000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_2_00_08_38",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 120000] },
      blinds: [40000, 80000],
      minBet: 80000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [3775000, 5110000, 8935000, 4545000, 7340000],
        automation.none,
        deck("   Th Qs Ac Qc As", "   5d 4s 5h Js Qh")
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(240000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      raiseTo(170000),
      fold,
      call,
      fold,
      raiseTo(875000),
      fold,
      raiseTo(4990000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(6195000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3735000, 4115000, 8765000, 4545000, 8545000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_3_00_15_36",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 150000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [4100000, 8775000, 4550000, 8525000, 3750000],
        automation.none,
        deck(
          "   Qd Ts 4c 7s Qc",
          "   8s 2d 3s 5h Tc",
          "?? Th8c5d",
          "?? 9d",
          "?? Jd"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raiseTo(200000),
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(600000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(175000),
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(950000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(950000);
    play(state, [
      burnCard,
      dealBoard,
      raiseTo(225000),
      raiseTo(700000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1875000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4050000, 8025000, 4550000, 8525000, 4550000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_4_00_18_39",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 150000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [8025000, 4550000, 8525000, 4550000, 4050000],
        automation.none,
        deck("   Qd 5h Jc 9h Jd", "   8s 3s 7c 4d 6s", "?? 2s5s2d", "?? As")
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      fold,
      call,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(350000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(175000),
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(700000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(300000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      7750000, 4825000, 8525000, 4550000, 4050000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_5_00_22_43",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4050000, 7750000, 4825000, 8525000, 4550000],
        automation.none,
        deck(
          "   Td Kd As 8c Kc",
          "   3c 3h 8d 5s 8s",
          "   4d 4c 5c Qc 3s",
          "??          6d 9s",
          "??          Ah Ad"
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      fold,
      fold,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(650000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(650000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1050000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4000000, 7700000, 4775000, 8275000, 4950000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_6_00_25_05",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4000000, 7700000, 4775000, 8275000, 4950000],
        automation.none,
        deck(
          "   Qd Ts 7c Th 8h",
          "   Js 9s 3s 4d 2h",
          "   Ac 8c 6d Jh Qs",
          "?? Kc 4c         ",
          "?? 5s 7h         ",
          "?? 2d 6c         ",
          "?? Ad Qc         "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      fold,
      raise,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1100000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1500000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3100000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3900000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2150000, 9750000, 4675000, 8225000, 4900000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_7_00_29_03",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2150000, 9750000, 4675000, 8225000, 4900000],
        automation.none,
        deck("   8d 9s Kd Ah Qs", "   2d 3c 2s Jd 5s", "   8h 7s 3s 6c Th")
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      fold,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(500000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2400000, 9700000, 4575000, 8175000, 4850000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_8_00_30_52",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2400000, 9700000, 4575000, 8175000, 4850000],
        automation.none,
        deck("   Qh 8s 7d 6h Qc", "   6c 5d 4d 3d 6d", "   Jd 3c Ts Td Th")
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      fold,
      fold,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(500000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2650000, 9600000, 4525000, 8125000, 4800000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_9_00_32_02",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2650000, 9600000, 4525000, 8125000, 4800000],
        automation.none,
        deck(
          "   Qd 9d Kc Qh Kh",
          "   7d 5c 7c Td 6d",
          "   5h 8d 6h Jd 2h",
          "??    9h    Qs   ",
          "??    3h    6s   ",
          "??    7h    3c   ",
          "??    5s    7s   "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      raise,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1100000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1500000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3100000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2600000, 11250000, 4475000, 6675000, 4700000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_10_00_34_43",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2600000, 11250000, 4475000, 6675000, 4700000],
        automation.none,
        deck("   5d 7h Js Ts Qc", "   2s 3s 6d 8s 9c", "   Ad 4h 9d Qh 9s")
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      raise,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(500000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2550000, 11150000, 4425000, 6925000, 4650000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_11_00_35_59",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2550000, 11150000, 4425000, 6925000, 4650000],
        automation.none,
        deck(
          "   Qh Js 9d Qs Qd",
          "   Tc Jc 8h Ts 3c",
          "   Th 2c 8c 4s 8d",
          "?? 6c 4h         ",
          "?? Kc 7h         ",
          "?? Ah 6h         ",
          "?? 6d 9c         "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      raise,
      call,
      fold,
      raise,
      raise,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1850000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2250000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3050000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3850000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(3850000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4750000, 9500000, 4175000, 6675000, 4600000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_12_00_41_13",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4175000, 6675000, 4600000, 4750000, 9500000],
        automation.none,
        deck(
          "   8d Jc As Kc Ad",
          "   7d 9s 8c Td Ts",
          "   5d 9d 7s 7c 3d",
          "   4d 6s 5h 5c 2s",
          "?? 3s7hKs",
          "?? 8s",
          "?? Ah"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1300000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2100000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2900000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4075000, 5275000, 6100000, 4750000, 9500000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_13_00_43_47",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [5275000, 6100000, 4750000, 9500000, 4075000],
        automation.none,
        deck(
          "   Ad 9h Js Ac Kd",
          "   Qc 8h Ts 9c Qd",
          "   Jd 7c 8d 7h 8c",
          "   2c 4d 5c 3s 4s",
          "?? 2hKh9s",
          "?? Tc",
          "?? As"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      fold,
      raise,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1400000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1800000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2600000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3400000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      7075000, 5900000, 4750000, 7900000, 4075000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_14_00_46_43",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [5900000, 4750000, 7900000, 4075000, 7075000],
        automation.none,
        deck(
          "   Kc Kd Ad Th Jd",
          "   Jh Qh Js 9s 9h",
          "   6h 8d Td 8h 9c",
          "   3s 3h 6s 3d 6d",
          "?? Ah9d6c"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [burnCard, dealBoard, call, raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(1100000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      5800000, 4350000, 8400000, 4075000, 7075000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_15_00_48_29",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4350000, 8400000, 4075000, 7075000, 5800000],
        automation.none,
        deck(
          "   5s As Kc Ah 9d",
          "   5d Qd 7d Kh 6h",
          "   4s 4d 5h Qs 6d",
          "   3c 2s 3h 2c 5c",
          "?? 7h4c8c",
          "?? Jd",
          "?? 9h"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      fold,
      raise,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1300000);
    play(state, [burnCard, dealBoard, call, raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2900000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3700000);
    play(state, [
      showOrMuck,
      showOrMuck,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4250000, 9375000, 4075000, 6200000, 5800000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_16_00_51_22",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [9375000, 4075000, 6200000, 5800000, 4250000],
        automation.none,
        deck(
          "   Ac As Ah 7h ??",
          "   Kd Qs Jh 7d ??",
          "   5s Th 7s 4c ??",
          "   3d 9c 6d 3s ??",
          "?? 6sQc7c",
          "?? Jd",
          "?? Jc"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      raise,
      fold,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1400000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(1400000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2200000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3000000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      7975000, 3875000, 7800000, 5800000, 4250000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_17_00_55_24",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3875000, 7800000, 5800000, 4250000, 7975000],
        automation.none,
        deck(
          "   Jc Ad 5h As Ac",
          "   7c 8d 3s Ks Qs",
          "   6d 6s 3h 4s 8c",
          "   2h 3d 2d 2s 2c",
          "?? KcAhJh",
          "?? Kd",
          "?? 8s"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      raise,
      raise,
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3100000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3900000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3775000, 7600000, 5400000, 6550000, 6375000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_18_00_58_03",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [7600000, 5400000, 6550000, 6375000, 3775000],
        automation.none,
        deck(
          "   Js Ad ?? 6c As",
          "   9h Kc ?? 5c Th",
          "   7s Qc ?? 4d Td",
          "   6d 9c ?? 2d 4c",
          "?? Qs5h9d",
          "?? Ac",
          "?? 8s"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      fold,
      raise,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [burnCard, dealBoard, call, raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1700000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2500000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(2500000);
    play(state, [
      showOrMuck,
      showOrMuck,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      7500000, 5450000, 6550000, 6425000, 3775000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_20_01_00_21",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [6550000, 6425000, 3775000, 7500000, 5450000],
        automation.none,
        deck(
          "   7c 8s 3s Qd 9d",
          "   3h 6s 2c 7h 8c",
          "   Kc 5s 8h 2d 5c",
          "??    Jh 6c      ",
          "??    Ks Js      ",
          "??    Kd 3c      "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      raise,
      call,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(700000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1100000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1900000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      6450000, 5575000, 4825000, 7450000, 5400000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_21_01_02_14",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [6450000, 5575000, 4825000, 7450000, 5400000],
        automation.none,
        deck(
          "   5s Qs 8d Ks Qc",
          "   4h 6s 4s 3s Tc",
          "   Th 6d 8s Qd 7s",
          "?? Ts       6c   "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      call,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(350000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(550000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      6700000, 5525000, 4775000, 7350000, 5350000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_22_01_03_57",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [6700000, 5525000, 4775000, 7350000, 5350000],
        automation.none,
        deck(
          "   Qd 8h Jh 9h 6c",
          "   2c 4h Jc 5c 2h",
          "   Ad Td Qh 7h 4d",
          "??          5s Ah"
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      call,
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(700000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      6650000, 5475000, 4675000, 7100000, 5800000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_23_01_06_16",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [6650000, 5475000, 4675000, 7100000, 5800000],
        automation.none,
        deck("   Ks 9d Td Ad 8d", "   9h 7d 6s 2h 2s", "   8h 9s Js Th 5d")
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      raise,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(500000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      6600000, 5425000, 4575000, 7050000, 6050000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_24_01_07_20",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [6600000, 5425000, 4575000, 7050000, 6050000],
        automation.none,
        deck(
          "   6s As 4s Tc 5h",
          "   3h 6h 3d 9c 4h",
          "   Kh 3c 2d Kd Js",
          "??    Jc 8s      ",
          "??    Ah 3s      ",
          "??    7d 5s      ",
          "??    5d 6c      "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      call,
      raise,
      fold,
      fold,
      fold,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1100000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1500000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3100000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3900000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      6500000, 3575000, 6625000, 7000000, 6000000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_25_01_10_31",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [6500000, 3575000, 6625000, 7000000, 6000000],
        automation.none,
        deck(
          "   7s Ks 5h Jd 9h",
          "   6d Jc 2h 3s 7c",
          "   5c Td 6s Qd 4d",
          "?? Ts    Ad    7h",
          "?? Qh    6h      ",
          "?? Kc    4c      "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      call,
      raise,
      fold,
      call,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 3),
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1300000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2100000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2500000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      5650000, 3525000, 7875000, 6900000, 5750000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_26_01_13_57",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 50000,
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [5650000, 3525000, 7875000, 6900000, 5750000],
        automation.none,
        deck(
          "   Kd Th 6c Ks 7s",
          "   5c 8d 4c 6d 3c",
          "   Jh Ah 7h 2c 5d",
          "??    Js Qh    3d",
          "??    7c 5s    As",
          "??       3s    Jc",
          "??       2s    4s"
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      raise,
      call,
      fold,
      call,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 3),
      raise,
      call,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1500000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 3),
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3100000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3900000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      5550000, 3075000, 10125000, 6850000, 4100000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_27_01_18_22",
  () => {
    const game = omaha.potLimit({
      antes: { kind: "byPosition", amounts: [0, 100000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [4100000, 5550000, 3075000, 10125000, 6850000],
        automation.none,
        deck(
          "   Qh As Qc Kh Ah",
          "   Qd Jc Jh Td Ac",
          "   Tc 6d 8s 8d 7h",
          "   2h 5s 2c 3s 2d"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      fold,
      fold,
      raiseTo(350000),
      fold,
      raiseTo(1100000),
      raiseTo(3350000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(4600000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4050000, 4350000, 3075000, 10125000, 8100000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_28_01_22_35",
  () => {
    const game = omaha.potLimit({
      antes: { kind: "byPosition", amounts: [0, 100000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [4350000, 3075000, 10125000, 8100000, 4050000],
        automation.none,
        deck(
          "   ?? Tc Ah Kd Ts",
          "   ?? 5h Kc 9h 8s",
          "   ?? 5d Qs 5s 6d",
          "   ?? 2c Jh 2h 3h"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      raiseTo(275000),
      fold,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(525000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4300000, 2875000, 10375000, 8100000, 4050000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_29_01_25_08",
  () => {
    const game = omaha.potLimit({
      antes: { kind: "byPosition", amounts: [0, 100000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [2875000, 10375000, 8100000, 4050000, 4300000],
        automation.none,
        deck(
          "   Td Kc Qh Ac Jh",
          "   4c Js Qd Qc 7s",
          "   2d 8c Th 8s 7d",
          "   2c 5d 6d 4h 3s"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      raiseTo(350000),
      fold,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(600000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2825000, 10175000, 8350000, 4050000, 4300000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_30_01_26_14",
  () => {
    const game = omaha.potLimit({
      antes: { kind: "byPosition", amounts: [0, 100000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [10175000, 8350000, 4050000, 4300000, 2825000],
        automation.none,
        deck(
          "   Jd Ah Qs 8h Tc",
          "   7h Ks 6s 8d 9h",
          "   5c 4d 6d 3s 7d",
          "   2c 2s 5d 3d 2d",
          "?? 6cJc4h",
          "?? 9s",
          "?? 7c"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      fold,
      fold,
      raiseTo(300000),
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [burnCard, dealBoard, raiseTo(250000), call, collectBets]);
    expect(totalPot(state.hand)).toBe(1250000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      10125000, 7700000, 4050000, 4300000, 3525000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_31_01_29_49",
  () => {
    const game = omaha.potLimit({
      antes: { kind: "byPosition", amounts: [0, 100000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [7700000, 4050000, 4300000, 3525000, 10125000],
        automation.none,
        deck(
          "   Js Ad Kh 9h 9c",
          "   Th Ts Jc 6s 7s",
          "   Td Tc 7h 4s 5h",
          "   6d 8h 7d 4h 2h",
          "?? 3c2dKc",
          "?? Qh",
          "?? 8c"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      fold,
      fold,
      fold,
      call,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      7750000, 4000000, 4300000, 3525000, 10125000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_32_01_32_58",
  () => {
    const game = omaha.potLimit({
      antes: { kind: "byPosition", amounts: [0, 100000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [4000000, 4300000, 3525000, 10125000, 7750000],
        automation.none,
        deck(
          "   Tc Ac Jh Ad Qh",
          "   9h Jd 9c Qd 9d",
          "   4h 8c 8d 7h 8s",
          "   2c 4d 5s 2s 5d",
          "?? As5h7d"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      fold,
      raiseTo(350000),
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(850000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(800000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1650000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3950000, 3850000, 3525000, 10625000, 7750000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_33_01_37_39",
  () => {
    const game = omaha.potLimit({
      antes: { kind: "byPosition", amounts: [0, 100000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [3850000, 3525000, 10625000, 7750000, 3950000],
        automation.none,
        deck(
          "   Qs Ks Td Qh Ac",
          "   5d Jd 8h 6d Tc",
          "   3d 7c 8c 5s 9h",
          "   2h 3c 2s 4s 2d",
          "?? 4h6h9c"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 4),
      fold,
      fold,
      raiseTo(250000),
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(650000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(375000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1025000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3800000, 3175000, 10625000, 7750000, 4350000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_34_01_39_18",
  () => {
    const game = holdem.fixedLimit({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3175000, 10625000, 7750000, 4350000, 3800000],
        automation.none,
        deck(
          "   Td Tc 6s 3h Jc",
          "   4c 9s 5h 3d 4d",
          "?? Ts9d5d",
          "?? Kc",
          "?? Qh"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raise,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [burnCard, dealBoard, call, raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1700000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2500000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(2500000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3075000, 11925000, 7750000, 3150000, 3800000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_35_01_42_31",
  () => {
    const game = holdem.fixedLimit({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [11925000, 7750000, 3150000, 3800000, 3075000],
        automation.none,
        deck(
          "   Ks Td ?? 5c Qc",
          "   Kc 4d ?? 3h 9s",
          "?? 9h2cJc",
          "?? Jd",
          "?? Tc"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raise,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1400000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1800000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2600000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3400000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      13725000, 7550000, 3150000, 3800000, 1475000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_36_01_44_49",
  () => {
    const game = holdem.fixedLimit({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [7550000, 3150000, 3800000, 1475000, 13725000],
        automation.none,
        deck("   Td Qs Ks ?? Jd", "   5c 9c Jc ?? 3c")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      raise,
      fold,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(700000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      7450000, 2950000, 4100000, 1475000, 13725000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_37_01_45_43",
  () => {
    const game = holdem.fixedLimit({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2950000, 4100000, 1475000, 13725000, 7450000],
        automation.none,
        deck("   8h 9d Kc Td Tc", "   4d 7c 8s 6h 7h")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2850000, 4200000, 1475000, 13725000, 7450000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_38_01_46_42",
  () => {
    const game = holdem.fixedLimit({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4200000, 1475000, 13725000, 7450000, 2850000],
        automation.none,
        deck("   5s Ah 8c 5d 9s", "   2c Qh 6c 4s 7h")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4100000, 1575000, 13725000, 7450000, 2850000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_39_01_47_38",
  () => {
    const game = holdem.fixedLimit({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1575000, 13725000, 7450000, 2850000, 4100000],
        automation.none,
        deck("   Js Ah 7s 6c Qs", "   9c 7d 4c 4h 8s", "?? 4s3c2c", "?? 6d")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(900000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1300000);
    play(state, [burnCard, dealBoard, raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(1700000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1475000, 14425000, 7450000, 2850000, 3500000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_40_01_51_27",
  () => {
    const game = holdem.fixedLimit({
      blinds: [100000, 200000],
      smallBet: 200000,
      bigBet: 400000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [14425000, 7450000, 2850000, 3500000, 1475000],
        automation.none,
        deck("   Jd 8d Jh Ah Ts", "   3d 7s 5d 4h Td", "?? AcQdKh", "?? 6c")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raise,
      raise,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1500000);
    play(state, [burnCard, dealBoard, call, raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2300000);
    play(state, [burnCard, dealBoard, raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(2700000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      14325000, 7250000, 2850000, 4800000, 475000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_41_01_53_52",
  () => {
    const game = draw.deuceToSevenSingle({
      antes: { kind: "byPosition", amounts: [0, 150000] },
      blinds: [50000, 100000],
      minBet: 100000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [7250000, 2850000, 4800000, 475000, 14325000],
        automation.none,
        deck(
          "   Js Ah Qc Qd Ks",
          "   Jc Ad 9h 8h Kc",
          "   9s Ac 4h 5s Ts",
          "   7h Jd 3s 4d 7s",
          "   6s 9d 3h 3d 5c"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      raiseTo(200000),
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(500000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      7200000, 2600000, 4800000, 775000, 14325000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_42_01_56_25",
  () => {
    const game = draw.deuceToSevenSingle({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [2600000, 4800000, 775000, 14325000, 7200000],
        automation.none,
        deck(
          "   ?? Qh Ah Kh Ad",
          "   ?? Jh 9s Qd Ts",
          "   ?? Jc 8s Js 7d",
          "   ?? 5c 8c 7h 4c",
          "   ?? 3s 2c 4h 3d"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      raiseTo(775000),
      fold,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1225000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2525000, 4425000, 1225000, 14325000, 7200000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_43_01_59_02",
  () => {
    const game = draw.deuceToSevenSingle({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [4425000, 1225000, 14325000, 7200000, 2525000],
        automation.none,
        deck(
          "   Kd 5s Ac Ts Ks",
          "   Jh 5c 8h Th Kh",
          "   Tc 4d 4s 9c 9s",
          "   6s 3s 4h 7h 6h",
          "   3c 3h 2h 7c 3d"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      fold,
      raiseTo(1000000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1375000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4800000, 850000, 14325000, 7200000, 2525000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_44_02_00_25",
  () => {
    const game = draw.deuceToSevenSingle({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [850000, 14325000, 7200000, 2525000, 4800000],
        automation.none,
        deck(
          "   Qs Qh Td Kd Qd",
          "   Qc Jd 9s 9h Jc",
          "   Js 5h 9c 8d Tc",
          "   Ts 5c 4d 3c 6h",
          "   2s ?? 3d 2d 4c"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      raiseTo(375000),
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(825000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      775000, 13950000, 7200000, 2975000, 4800000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_45_02_01_50",
  () => {
    const game = draw.deuceToSevenSingle({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [13950000, 7200000, 2975000, 4800000, 775000],
        automation.none,
        deck(
          "   Kd Js Kh Ah Ts",
          "   Jh Jd Qc Ac 9s",
          "   6c 8d Th Ks 9h",
          "   5s 5h 8h 7c 4d",
          "   4h 3h 2h 3c 2c",
          "??    Qh         ",
          "      8c         ",
          "               4s"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      raiseTo(775000),
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1850000);
    play(state, [
      discard("JsJd"),
      discard("9h"),
      burnCard,
      dealHole,
      dealHole,
      dealHole,
    ]);
    expect(totalPot(state.hand)).toBe(1850000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      13875000, 6200000, 2975000, 4800000, 1850000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_46_02_04_37",
  () => {
    const game = draw.deuceToSevenSingle({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [6200000, 2975000, 4800000, 1850000, 13875000],
        automation.none,
        deck(
          "   Kh As Ad Qs 8s",
          "   Kd Jc Ks 8d 7h",
          "   Jd 6s Qd 8c 5h",
          "   Tc 4d Th 3c 3h",
          "   9d 2h 2c 2d 3d",
          "??    6c         ",
          "      5s         ",
          "               Ah"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      raiseTo(350000),
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [
      discard("JcAs"),
      discard("3h"),
      burnCard,
      dealHole,
      dealHole,
      dealHole,
      call,
      call,
    ]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      6125000, 2400000, 4800000, 1850000, 14525000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_47_02_07_21",
  () => {
    const game = draw.deuceToSevenSingle({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [2400000, 4800000, 1850000, 14525000, 6125000],
        automation.none,
        deck(
          "   Kc Js Jd Ks Ad",
          "   8c 3s 8h Kh Ac",
          "   6s 2s 5s Qc Ts",
          "   5c 2d 4h Jh 8d",
          "   3c 2c 4c Td 6h"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      fold,
      raiseTo(2400000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2775000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2775000, 4425000, 1850000, 14525000, 6125000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_48_02_09_20",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4425000, 1850000, 14525000, 6125000, 2775000],
        automation.none,
        deck(
          "   Ac Tc Td Kd 8h",
          "   8d 4h 7h Js 3h",
          "   As 5s 2h Jd Ah",
          "?? Th          3s",
          "?? 3c          Jc",
          "?? Ts          7d",
          "?? 7c          4s"
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      raise,
      raise,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1325000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1825000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2825000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3825000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(4825000);
    play(state, [
      showOrMuck,
      showOrMuck,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4537500, 1800000, 14400000, 6075000, 2887500,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_49_02_13_08",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4550000, 1800000, 14400000, 6075000, 2875000],
        automation.none,
        deck("   ?? Js Tc Jh ??", "   ?? 4s 3h 6s ??", "   ?? Th Jd 2h ??")
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      fold,
      fold,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(575000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4500000, 1750000, 14675000, 5950000, 2825000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_50_02_14_32",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4500000, 1750000, 14675000, 5950000, 2825000],
        automation.none,
        deck(
          "   6s 5c Ac ?? Td",
          "   5h 2s 7d ?? 2h",
          "   6d Js 3h ?? Ah",
          "?? As    6c      ",
          "?? 4h    2d      ",
          "?? 7s    2c      ",
          "?? Jc    Kh      "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1250000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2250000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3250000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(4250000);
    play(state, [
      showOrMuck,
      showOrMuck,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4575000, 1700000, 14750000, 5900000, 2775000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_51_02_18_42",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4575000, 1700000, 14750000, 5900000, 2775000],
        automation.none,
        deck(
          "   ?? 7d Tc 7h 8d",
          "   ?? 2d 9h 3s 3h",
          "   ?? Ts Ah 6s 2h",
          "??          4d 5c",
          "??          9c Jd",
          "??          8s 6d",
          "??          8h 2c"
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      fold,
      fold,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1250000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2250000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3250000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(4250000);
    play(state, [
      showOrMuck,
      showOrMuck,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4525000, 1650000, 14700000, 5975000, 2850000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_52_02_22_35",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4525000, 1650000, 14700000, 5975000, 2850000],
        automation.none,
        deck(
          "   ?? Ts 2s 7d Ks",
          "   ?? 9c 2d 2c Jc",
          "   ?? Jh Ah 2h Kh",
          "??          Kd 8d"
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4475000, 1600000, 14650000, 5675000, 3300000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_53_02_25_11",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4475000, 1600000, 14650000, 5675000, 3300000],
        automation.none,
        deck(
          "   Kd Qh Jd 7h ??",
          "   Qd 4d 7d 4h ??",
          "   Qs 6s 9h 4c ??",
          "?? 6h       2c   ",
          "?? Ad       Td   ",
          "?? Kc       Jh   "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      fold,
      raise,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1250000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2250000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(2750000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      5675000, 1550000, 14600000, 4625000, 3250000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_54_02_28_14",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [5675000, 1550000, 14600000, 4625000, 3250000],
        automation.none,
        deck(
          "   7d Ts Th Kd 9c",
          "   5d 6c 8c 2c 4c",
          "   Ah 7h Tc As 3c",
          "?? 3s       Js   "
        )
      )
    );
    play(state, [...repeat(postAnte, 5), collectBets]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 5 * 3),
      bringIn,
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      6125000, 1500000, 14550000, 4575000, 2950000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_55_02_29_59",
  () => {
    const game = draw.deuceToSevenTriple({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [6125000, 1500000, 14550000, 4575000, 2950000],
        automation.none,
        deck(
          "   Qd Ks Qh Ah Js",
          "   Jc Kd Qc Ad 9s",
          "   8s 4s Jd Qs 9c",
          "   7d 4c 8c 9h 5d",
          "   5h 2s 3h 4d 2d",
          "?? As            ",
          "   6s            ",
          "      7s         ",
          "      7c         ",
          "      5c         ",
          "?? 9d            ",
          "      6h         ",
          "?? 7h            "
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      fold,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [
      discard("QdJc"),
      discard("KsKd4s"),
      burnCard,
      dealHole,
      dealHole,
      dealHole,
      dealHole,
      dealHole,
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2000000);
    play(state, [
      discard("As"),
      discard("7s"),
      burnCard,
      dealHole,
      dealHole,
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3000000);
    play(state, [discard("8s"), standPat, burnCard, dealHole]);
    expect(totalPot(state.hand)).toBe(3000000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4625000, 3000000, 14550000, 4575000, 2950000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_56_02_34_51",
  () => {
    const game = draw.deuceToSevenTriple({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3000000, 14550000, 4575000, 2950000, 4625000],
        automation.none,
        deck(
          "   Ah Jd Kc 2d 8s",
          "   Kh 9h Qd 2h 8c",
          "   Qs 7h Th 2s 6c",
          "   4h 7d 5s 3c 5d",
          "   3h 6d 2c 3s 3d"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(875000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2875000, 14300000, 4575000, 2950000, 5000000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_57_02_36_12",
  () => {
    const game = draw.deuceToSevenTriple({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [14300000, 4575000, 2950000, 5000000, 2875000],
        automation.none,
        deck(
          "   Qs As Kd Ad Ac",
          "   9s Ks Kc Qh Td",
          "   9h 8s 8c Ts 7h",
          "   6d 5h 7d 4d 3d",
          "   3c 4c 7c 3h 2s",
          "??    Jh         ",
          "      4s         ",
          "               Qc",
          "               5c",
          "??    4h         ",
          "      2d         ",
          "               3s",
          "??    9d         ",
          "               6h"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1125000);
    play(state, [
      discard("AsKs"),
      discard("AcTd"),
      burnCard,
      dealHole,
      dealHole,
      dealHole,
      dealHole,
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1625000);
    play(state, [
      discard("Jh4s"),
      discard("Qc"),
      burnCard,
      dealHole,
      dealHole,
      dealHole,
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2625000);
    play(state, [
      discard("4h"),
      discard("3s"),
      burnCard,
      dealHole,
      dealHole,
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(4625000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      14175000, 2325000, 2950000, 5000000, 5250000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_58_02_40_27",
  () => {
    const game = draw.deuceToSevenTriple({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2325000, 2950000, 5000000, 5250000, 14175000],
        automation.none,
        deck(
          "   Jc Ah ?? Kd Kh",
          "   8s Ks ?? Qs Qh",
          "   6s Jd ?? 9d Ts",
          "   4d Tc ?? 8d Th",
          "   3c 3h ?? 7c 5d"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      fold,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(750000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2575000, 2700000, 5000000, 5250000, 14175000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_59_02_41_31",
  () => {
    const game = draw.deuceToSevenTriple({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2700000, 5000000, 5250000, 14175000, 2575000],
        automation.none,
        deck(
          "   Ac Ah ?? 6h Ad",
          "   Td Kh ?? 4d Qs",
          "   9s Th ?? 4c Qd",
          "   5h 8d ?? 3d 5s",
          "   5d 4s ?? 2s 5c"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      raise,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(875000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2575000, 4750000, 5250000, 14550000, 2575000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_60_02_42_44",
  () => {
    const game = draw.deuceToSevenTriple({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4750000, 5250000, 14550000, 2575000, 2575000],
        automation.none,
        deck(
          "   ?? Kh As Ac Qd",
          "   ?? 7c Ad Jc Jd",
          "   ?? 6d 6h Th 5h",
          "   ?? 2c 3h Tc 5d",
          "   ?? ?? 2h 3c 4c",
          "??    5s         ",
          "      3d         ",
          "         7d      ",
          "         2s      ",
          "??       4d      ",
          "??               "
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1125000);
    play(state, [
      discard("Kh??"),
      discard("AsAd"),
      burnCard,
      dealHole,
      dealHole,
      dealHole,
      dealHole,
      raise,
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2625000);
    play(state, [
      standPat,
      discard("2h"),
      burnCard,
      dealHole,
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(4625000);
    play(state, [standPat, standPat, burnCard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(5625000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      4625000, 2500000, 17425000, 2575000, 2575000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_61_02_46_42",
  () => {
    const game = draw.deuceToSevenTriple({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2500000, 17425000, 2575000, 2575000, 4625000],
        automation.none,
        deck(
          "   5c 9d Kd Ac Th",
          "   4h 7h Qs Kh 7c",
          "   4d 6d Qc Js 6s",
          "   4c 6c 4s 8d 3h",
          "   3s 2c 2s 3c 2d",
          "??    8s         ",
          "      5s         ",
          "               Qh",
          "??             7d",
          "??             Jc"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 5 * 5),
      fold,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1125000);
    play(state, [
      discard("9d6c"),
      discard("Th"),
      burnCard,
      dealHole,
      dealHole,
      dealHole,
      call,
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2125000);
    play(state, [
      standPat,
      discard("Qh"),
      burnCard,
      dealHole,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3125000);
    play(state, [standPat, discard("7d"), burnCard, dealHole, call, call]);
    expect(totalPot(state.hand)).toBe(3125000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2375000, 19050000, 2575000, 2575000, 3125000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_62_02_51_10",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [19050000, 2575000, 2575000, 3125000, 2375000],
        automation.none,
        deck("   Kc 8s 9d Tc As", "   8h 4s 8c 2d 4c")
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      fold,
      raiseTo(2350000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2725000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      19425000, 2200000, 2575000, 3125000, 2375000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_63_02_53_09",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [2200000, 2575000, 3125000, 2375000, 19425000],
        automation.none,
        deck("   4h Qd Td Ad Js", "   3c 6d 2s 5s 6c")
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raiseTo(2375000),
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2825000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2125000, 2200000, 3125000, 2825000, 19425000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_64_02_54_12",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [2200000, 3125000, 2825000, 19425000, 2125000],
        automation.none,
        deck("   3s Kh Jd Ks 8d", "   3d 6c 5h 4c 2d")
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raiseTo(300000),
      fold,
      raiseTo(2200000),
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2875000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2875000, 2750000, 2825000, 19125000, 2125000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_65_02_56_12",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [2750000, 2825000, 19125000, 2125000, 2875000],
        automation.none,
        deck("   8c Qd Kh Ks Kd", "   2c Js 5h 5s 6c")
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      raiseTo(300000),
      fold,
      fold,
      fold,
      raiseTo(2600000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3200000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2675000, 3200000, 18825000, 2125000, 2875000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_66_02_57_27",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [3200000, 18825000, 2125000, 2875000, 2675000],
        automation.none,
        deck("   7s Jc 8c Ks Td", "   5s 3c 2s Jd 5d", "?? 8dAdQc")
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raiseTo(400000),
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1100000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raiseTo(350000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1450000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3125000, 18200000, 2125000, 3575000, 2675000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_67_03_00_32",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [18200000, 2125000, 3575000, 2675000, 3125000],
        automation.none,
        deck("   Th Ac Js Kh 5d", "   2c 5c 4s 3h 3s")
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      fold,
      call,
      raiseTo(1900000),
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2275000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      18050000, 2275000, 3575000, 2675000, 3125000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_68_03_02_41",
  () => {
    const game = holdem.noLimit({
      antes: { kind: "byPosition", amounts: [0, 225000] },
      blinds: [75000, 150000],
      minBet: 150000,
      anteTrimming: false,
    });
    const state = drive(
      start(
        game,
        [2275000, 3575000, 2675000, 3125000, 18050000],
        automation.none,
        deck(
          "   8d 9d 6c Js Ac",
          "   3s 9c 5h 4h Kc",
          "?? 2c8cTh",
          "?? Ah",
          "?? 6d"
        )
      )
    );
    play(state, [postAnte, collectBets, postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raiseTo(300000),
      fold,
      raiseTo(3350000),
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(7000000);
    play(state, [showOrMuck, showOrMuck, burnCard, dealBoard]);
    expect(totalPot(state.hand)).toBe(7000000);
    play(state, [burnCard, dealBoard]);
    expect(totalPot(state.hand)).toBe(7000000);
    play(state, [burnCard, dealBoard]);
    expect(totalPot(state.hand)).toBe(7000000);
    play(state, [killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2200000, 0, 2675000, 3125000, 21700000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_69_03_05_55",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2675000, 3125000, 21700000, 2200000],
        automation.none,
        deck(
          "   Ks Js Kh 7s",
          "   2h 6h Tc 5s",
          "   3d Qd Jd 9s",
          "??    9h    8c",
          "??    Jh    5d",
          "??    Kd    Jc",
          "??    4d    7d"
        )
      )
    );
    play(state, [...repeat(postAnte, 4), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 4 * 3),
      bringIn,
      raise,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1275000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1775000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(1775000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2775000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(2775000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2550000, 1825000, 21650000, 3675000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_71_03_11_08",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2425000, 2050000, 21600000, 3625000],
        automation.none,
        deck("   8h 3d 9h As", "   5s 3c 2h Qd", "   Tc Kc 2d Ts")
      )
    );
    play(state, [...repeat(postAnte, 4), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 4 * 3),
      bringIn,
      raise,
      fold,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1025000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2375000, 2525000, 21475000, 3325000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_72_03_12_55",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2375000, 2525000, 21475000, 3325000],
        automation.none,
        deck(
          "   5d Tc As Th",
          "   2s 9h 3d 5c",
          "   Ad Ac 8c 5s",
          "??    9c 4d   "
        )
      )
    );
    play(state, [...repeat(postAnte, 4), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 4 * 3),
      bringIn,
      fold,
      raise,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1275000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2025000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2325000, 3500000, 20675000, 3200000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_73_03_14_40",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2325000, 3500000, 20675000, 3200000],
        automation.none,
        deck(
          "   5s Kd Jc 9c",
          "   3c 8h Ts 6h",
          "   9s 7h 8c Ah",
          "??    Kc Th   ",
          "??    2c Ac   ",
          "??    Tc 3s   ",
          "??    Jd 7c   "
        )
      )
    );
    play(state, [...repeat(postAnte, 4), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 4 * 3),
      bringIn,
      raise,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(700000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1200000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2200000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3200000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(4200000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2275000, 5650000, 18625000, 3150000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_74_03_17_31",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2275000, 5650000, 18625000, 3150000],
        automation.none,
        deck(
          "   Kh Qc Td Ah",
          "   7h 5d 3h 6s",
          "   7s 3c As 5c",
          "?? 3s    4s   "
        )
      )
    );
    play(state, [...repeat(postAnte, 4), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 4 * 3),
      bringIn,
      raise,
      fold,
      call,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(775000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1025000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2750000, 5525000, 18325000, 3100000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_75_03_19_14",
  () => {
    const game = stud.fixedLimit({
      antes: { kind: "everyone", amount: 50000 },
      bringIn: 75000,
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2750000, 5525000, 18325000, 3100000],
        automation.none,
        deck(
          "   9d Kc Ah Th",
          "   7d Jh 2d 7h",
          "   4s Ts Tc Qh",
          "??    9h    6c",
          "??    7s    7c",
          "??    Js    As"
        )
      )
    );
    play(state, [...repeat(postAnte, 4), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 4 * 3),
      bringIn,
      raise,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1275000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(1275000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(1275000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1775000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2625000, 6250000, 18275000, 2550000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_76_03_22_08",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2625000, 6250000, 18275000, 2550000],
        automation.none,
        deck(
          "   ?? Ad As Qh",
          "   ?? Ac 8c 9s",
          "   ?? Ts 3s 5d",
          "   ?? 8s 2c 4c",
          "?? Jd7s4h",
          "?? 5h",
          "?? Js"
        )
      )
    );
    play(state, [postBlind]);
    expect(totalPot(state.hand)).toBe(250000);
    play(state, [
      ...repeat(dealHole, 4 * 4),
      raise,
      raise,
      fold,
      fold,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2250000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2750000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3750000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(3750000);
    play(state, [
      showOrMuck,
      showOrMuck,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2375000, 6375000, 18400000, 2550000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_77_03_25_05",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2375000, 6375000, 18400000, 2550000],
        automation.none,
        deck(
          "   Ad Td Qs Ah",
          "   7s 9s 6c Ac",
          "   5s 4s 3s 8s",
          "   3d 3h 2c 5c",
          "?? 8h6dQd",
          "?? Jd",
          "?? Qh"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 4 * 4),
      raise,
      raise,
      call,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2500000);
    play(state, [burnCard, dealBoard, call, call, call]);
    expect(totalPot(state.hand)).toBe(2500000);
    play(state, [burnCard, dealBoard, raise, call, call, collectBets]);
    expect(totalPot(state.hand)).toBe(4000000);
    play(state, [burnCard, dealBoard, raise, raise, fold, call, collectBets]);
    expect(totalPot(state.hand)).toBe(6000000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([125000, 6125000, 22150000, 1300000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_78_03_32_24",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [6125000, 22150000, 1300000, 125000],
        automation.none,
        deck(
          "   Ad Qc 9h 4d",
          "   5d Tc 9d 3s",
          "   4s 7c 5h 3c",
          "   2c 3h 3d 2d",
          "?? JdKs2h",
          "?? Td",
          "?? Qh"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [
      ...repeat(dealHole, 4 * 4),
      fold,
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1125000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1625000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(1625000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(1625000);
    play(state, [
      showOrMuck,
      showOrMuck,
      showOrMuck,
      killHand,
      killHand,
      pushChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([5375000, 23025000, 1300000, 0]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_79_03_36_22",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [125000, 250000],
      smallBet: 250000,
      bigBet: 500000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [23025000, 1300000, 5375000],
        automation.none,
        deck(
          "   Ah Kc Ac",
          "   7s Qc Ks",
          "   6d 3s Qd",
          "   2d 2h 2s",
          "?? 4s3hQh",
          "?? 5s",
          "?? 5d"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(375000);
    play(state, [...repeat(dealHole, 3 * 4), raise, call, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1500000);
    play(state, [
      burnCard,
      dealBoard,
      raise,
      raise,
      call,
      raise,
      raise,
      call,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(3900000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(4900000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(5900000);
    play(state, [
      showOrMuck,
      showOrMuck,
      showOrMuck,
      killHand,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([25150000, 0, 4550000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_80_03_42_38",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [150000, 300000],
      smallBet: 300000,
      bigBet: 600000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4550000, 25150000],
        automation.none,
        deck(
          "   Ks 9s",
          "   Js 4s",
          "   5s 3c",
          "   4d 2d",
          "?? 8s2c7d",
          "?? Jd",
          "?? 8d"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [...repeat(dealHole, 2 * 4), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1200000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1800000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3000000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(3000000);
    play(state, [
      showOrMuck,
      showOrMuck,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([4550000, 25150000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_81_03_44_38",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [150000, 300000],
      smallBet: 300000,
      bigBet: 600000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [25150000, 4550000],
        automation.none,
        deck(
          "   Ac Th",
          "   9h 7h",
          "   8h 7d",
          "   2c 5d",
          "?? 7c6cQh",
          "?? 5c",
          "?? 6h"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [...repeat(dealHole, 2 * 4), raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1800000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2400000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3600000);
    play(state, [
      burnCard,
      dealBoard,
      call,
      raise,
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(7200000);
    play(state, [
      showOrMuck,
      showOrMuck,
      pushChips,
      pushChips,
      pullChips,
      pullChips,
    ]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([25150000, 4550000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_82_03_46_32",
  () => {
    const game = omaha.fixedLimitHiLo({
      blinds: [150000, 300000],
      smallBet: 300000,
      bigBet: 600000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [4550000, 25150000],
        automation.none,
        deck(
          "   Ah 4s",
          "   Qc 2s",
          "   9h 2h",
          "   5d 2c",
          "?? 2dQsAd",
          "?? 7d",
          "?? 9s"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(450000);
    play(state, [...repeat(dealHole, 2 * 4), raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1800000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2400000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3600000);
    play(state, [burnCard, dealBoard, call, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(4800000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2150000, 27550000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_83_03_48_33",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 100000 },
      bringIn: 100000,
      smallBet: 300000,
      bigBet: 600000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2150000, 27550000],
        automation.none,
        deck("   Qh As", "   Qd 2c", "   8s 6h")
      )
    );
    play(state, [...repeat(postAnte, 2), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 2 * 3),
      bringIn,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(600000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([1950000, 27750000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_84_03_49_18",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 100000 },
      bringIn: 100000,
      smallBet: 300000,
      bigBet: 600000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1950000, 27750000],
        automation.none,
        deck("   Kd Ah", "   7s 6s", "   4h Kc", "?? As 9s", "?? 8c Qd")
      )
    );
    play(state, [...repeat(postAnte, 2), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 2 * 3),
      bringIn,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(800000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1400000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(2000000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([2650000, 27050000]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_43_5.StateTestCase.test_85_03_50_24",
  () => {
    const game = stud.razz({
      antes: { kind: "everyone", amount: 100000 },
      bringIn: 100000,
      smallBet: 300000,
      bigBet: 600000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2650000, 27050000],
        automation.none,
        deck(
          "   8c 4h",
          "   2h 3d",
          "   4c 8d",
          "?? Ad 2s",
          "?? Qd Td",
          "?? Jd 8s",
          "?? Kh 7h"
        )
      )
    );
    play(state, [...repeat(postAnte, 2), collectBets]);
    expect(totalPot(state.hand)).toBe(200000);
    play(state, [
      ...repeat(dealHole, 2 * 3),
      bringIn,
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1400000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(2600000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(3800000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(5300000);
    play(state, [showOrMuck, showOrMuck, burnCard, ...repeat(dealHole, 2)]);
    expect(totalPot(state.hand)).toBe(5300000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([0, 29700000]);
    replaysTheSameHand(state.hand);
  }
);
