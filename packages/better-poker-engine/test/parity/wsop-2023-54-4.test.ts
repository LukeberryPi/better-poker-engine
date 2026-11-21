import { expect } from "bun:test";

import { unitTest } from "../../../../parity/harness.ts";
import { automation, type Hand } from "../../src/hand.ts";
import { holdem, stud } from "../../src/rules.ts";
import {
  drive,
  moves,
  play,
  repeat,
  stacks,
  start,
  totalPot,
} from "../driver.ts";
import { dealer, deck, replaysWithout } from "./wsop.ts";

const { call, fold, raise, bringIn } = moves;
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
  replaysWithout(hand, ["holeDealt"]);
}

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_1_00_02_05",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20_000 },
      bringIn: 20_000,
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1_930_000, 3_695_000, 990_000, 1_445_000, 515_000, 2_160_000, 265_000],
        automation.none,
        deck(
          "   8s Qs Qh 6d Tc Ah Ks",
          "   5h 7h 3s 5c 3h Kd 9h",
          "   7s 8c 9c As 7c 6s 8d"
        )
      )
    );
    play(state, [...repeat(postAnte, 7), collectBets]);
    expect(totalPot(state.hand)).toBe(140_000);
    play(state, [
      ...repeat(dealHole, 7 * 3),
      bringIn,
      fold,
      fold,
      fold,
      fold,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(240_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1_910_000, 3_675_000, 970_000, 1_585_000, 495_000, 2_120_000, 245_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_2_00_03_32",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20_000 },
      bringIn: 20_000,
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1_910_000, 3_675_000, 970_000, 1_585_000, 495_000, 2_120_000, 245_000],
        automation.none,
        deck(
          "   6s Js Kc Th 8c 9h 5h",
          "   6h 7h 2h 7s 2c 5d 2s",
          "   5s Jd 3c Ks Jc 3s 8h",
          "?? 6d 7c             4h",
          "?? 9s Qh             9d",
          "?? 6c 3d             9c",
          "?? 4c Ac             Tc"
        )
      )
    );
    play(state, [...repeat(postAnte, 7), collectBets]);
    expect(totalPot(state.hand)).toBe(140_000);
    play(state, [
      ...repeat(dealHole, 7 * 3),
      bringIn,
      fold,
      fold,
      fold,
      raise,
      raise,
      call,
      fold,
      raise,
      call,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(835_000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 3),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(995_000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 3),
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1_635_000);
    play(state, [burnCard, ...repeat(dealHole, 3), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1_955_000);
    play(state, [burnCard, ...repeat(dealHole, 3), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2_275_000);
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
    expect(stacks(state.hand)).toEqual([
      3_220_000, 2_710_000, 930_000, 1_565_000, 475_000, 2_100_000, 0,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_3_00_10_24",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20_000 },
      bringIn: 20_000,
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3_220_000, 2_710_000, 930_000, 1_565_000, 475_000, 2_100_000],
        automation.none,
        deck(
          "   Kc Ah Qs ?? ?? ??",
          "   2d 5d Td ?? ?? ??",
          "   7d Th 3s ?? ?? ??",
          "??    2c 4h         ",
          "??    3d Kh         "
        )
      )
    );
    play(state, [...repeat(postAnte, 6), collectBets]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 6 * 3),
      bringIn,
      fold,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(160_000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(320_000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(480_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3_200_000, 2_910_000, 810_000, 1_545_000, 455_000, 2_080_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_4_00_12_25",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20_000 },
      bringIn: 20_000,
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3_200_000, 2_910_000, 810_000, 1_545_000, 455_000, 2_080_000],
        automation.none,
        deck(
          "   9c 6d Ts ?? Ac 6c",
          "   7s 3s 4s ?? 2h 3d",
          "   9h Ah 5s ?? Th Js"
        )
      )
    );
    play(state, [...repeat(postAnte, 6), collectBets]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 6 * 3),
      bringIn,
      fold,
      fold,
      fold,
      raise,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(380_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3_100_000, 3_110_000, 770_000, 1_525_000, 435_000, 2_060_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_5_00_13_47",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20_000 },
      bringIn: 20_000,
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3_100_000, 3_110_000, 770_000, 1_525_000, 435_000, 2_060_000],
        automation.none,
        deck(
          "   8h Qd Tc Jc Ac 3d",
          "   7c 2d 7s 7h 8c 2c",
          "   6s 9d Kh 4s Kd Ts",
          "?? Kc 5c            "
        )
      )
    );
    play(state, [...repeat(postAnte, 6), collectBets]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 6 * 3),
      bringIn,
      fold,
      fold,
      raise,
      call,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(300_000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(380_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3_000_000, 3_310_000, 750_000, 1_485_000, 415_000, 2_040_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_6_00_15_43",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20_000 },
      bringIn: 20_000,
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3_000_000, 3_310_000, 750_000, 1_485_000, 415_000, 2_040_000],
        automation.none,
        deck(
          "   9h 8s Ah Kd As 6s",
          "   7d 2d 9c 8d 3c 6c",
          "   Kc Tc 4d Kh 6d Jc",
          "??          Qd 8h   ",
          "??          Ad 8c   ",
          "??          Qh 9d   ",
          "??          Ks Jh   "
        )
      )
    );
    play(state, [...repeat(postAnte, 6), collectBets]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 6 * 3),
      bringIn,
      raise,
      call,
      fold,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(300_000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(300_000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(620_000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(930_000);
    play(state, [showOrMuck, showOrMuck, burnCard, ...repeat(dealHole, 2)]);
    expect(totalPot(state.hand)).toBe(930_000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2_980_000, 3_290_000, 710_000, 2_000_000, 0, 2_020_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_7_00_20_03",
  () => {
    const game = holdem.fixedLimit({
      blinds: [80_000],
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2_020_000, 2_980_000, 3_290_000, 710_000, 2_000_000],
        automation.none,
        deck("   ?? Js ?? 8d ??", "   ?? 3h ?? 7d ??")
      )
    );
    play(state, [postBlind]);
    expect(totalPot(state.hand)).toBe(80_000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(240_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1_940_000, 2_980_000, 3_290_000, 790_000, 2_000_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_8_00_20_31",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40_000, 80_000],
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1_940_000, 2_980_000, 3_290_000, 790_000, 2_000_000],
        automation.none,
        deck(
          "   Qs 9h Qc Jd Tc",
          "   8h 8c 2s 7h 4c",
          "?? Ts8d4d",
          "?? 7c",
          "?? 6d"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      fold,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(320_000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(480_000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(800_000);
    play(state, [burnCard, dealBoard, call, raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(960_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1_540_000, 3_380_000, 3_290_000, 790_000, 2_000_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_9_00_23_52",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40_000, 80_000],
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3_380_000, 3_290_000, 790_000, 2_000_000, 1_540_000],
        automation.none,
        deck(
          "   ?? Ah ?? ?? Js",
          "   ?? 4h ?? ?? Jc",
          "?? Qh7sTh",
          "?? As",
          "?? 5s"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(360_000);
    play(state, [burnCard, dealBoard, call, raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(680_000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1_000_000);
    play(state, [burnCard, dealBoard, raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(1_160_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3_340_000, 3_810_000, 790_000, 2_000_000, 1_060_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_10_00_26_43",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40_000, 80_000],
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3_810_000, 790_000, 2_000_000, 1_060_000, 3_340_000],
        automation.none,
        deck("   Td 9s Kc Qs Tc", "   7c 3h 4c Qd 9d")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raise,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(280_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3_770_000, 710_000, 2_000_000, 1_180_000, 3_340_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_11_00_27_27",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40_000, 80_000],
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [710_000, 2_000_000, 1_180_000, 3_340_000, 3_770_000],
        automation.none,
        deck("   7s Jh Qc Kc Ac", "   5h 3c 8h 5s 9s")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(280_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      670_000, 1_920_000, 1_180_000, 3_340_000, 3_890_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_12_00_28_26",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40_000, 80_000],
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1_920_000, 1_180_000, 3_340_000, 3_890_000, 670_000],
        automation.none,
        deck("   Ah 9d ?? 2s 6h", "   Js 9c ?? 2h 4h", "?? 8d3d6d")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raise,
      fold,
      raise,
      raise,
      call,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(960_000);
    play(state, [burnCard, dealBoard, call, raise, fold, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(1_040_000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1_600_000, 1_820_000, 3_340_000, 3_570_000, 670_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_13_00_31_44",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40_000, 80_000],
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1_820_000, 3_340_000, 3_570_000, 670_000, 1_600_000],
        automation.none,
        deck(
          "   Jh ?? ?? ?? Qd",
          "   Jd ?? ?? ?? 9d",
          "?? 4s2s7h",
          "?? 9s",
          "?? 6c"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120_000);
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
    expect(totalPot(state.hand)).toBe(560_000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(720_000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1_040_000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1_360_000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2_540_000, 3_260_000, 3_570_000, 670_000, 960_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_14_00_34_31",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40_000, 80_000],
      smallBet: 80_000,
      bigBet: 160_000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3_260_000, 3_570_000, 670_000, 960_000, 2_540_000],
        automation.none,
        deck(
          "   5d Ah As Qh Qc",
          "   2c 8c 7s 2h 3s",
          "?? TdAd2s",
          "?? Js",
          "?? 6h"
        )
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120_000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(360_000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(360_000);
    play(state, [burnCard, dealBoard, call, raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1_000_000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(1_000_000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3_220_000, 4_090_000, 190_000, 960_000, 2_540_000,
    ]);
    replaysTheSameHand(state.hand);
  }
);
