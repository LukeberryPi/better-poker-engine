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
      antes: { kind: "everyone", amount: 20000 },
      bringIn: 20000,
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1930000, 3695000, 990000, 1445000, 515000, 2160000, 265000],
        automation.none,
        deck(
          "   8s Qs Qh 6d Tc Ah Ks",
          "   5h 7h 3s 5c 3h Kd 9h",
          "   7s 8c 9c As 7c 6s 8d"
        )
      )
    );
    play(state, [...repeat(postAnte, 7), collectBets]);
    expect(totalPot(state.hand)).toBe(140000);
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
    expect(totalPot(state.hand)).toBe(240000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1910000, 3675000, 970000, 1585000, 495000, 2120000, 245000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_2_00_03_32",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20000 },
      bringIn: 20000,
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1910000, 3675000, 970000, 1585000, 495000, 2120000, 245000],
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
    expect(totalPot(state.hand)).toBe(140000);
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
    expect(totalPot(state.hand)).toBe(835000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 3),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(995000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 3),
      raise,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(1635000);
    play(state, [burnCard, ...repeat(dealHole, 3), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1955000);
    play(state, [burnCard, ...repeat(dealHole, 3), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(2275000);
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
      3220000, 2710000, 930000, 1565000, 475000, 2100000, 0,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_3_00_10_24",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20000 },
      bringIn: 20000,
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3220000, 2710000, 930000, 1565000, 475000, 2100000],
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
    expect(totalPot(state.hand)).toBe(120000);
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
    expect(totalPot(state.hand)).toBe(160000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(320000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(480000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3200000, 2910000, 810000, 1545000, 455000, 2080000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_4_00_12_25",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20000 },
      bringIn: 20000,
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3200000, 2910000, 810000, 1545000, 455000, 2080000],
        automation.none,
        deck(
          "   9c 6d Ts ?? Ac 6c",
          "   7s 3s 4s ?? 2h 3d",
          "   9h Ah 5s ?? Th Js"
        )
      )
    );
    play(state, [...repeat(postAnte, 6), collectBets]);
    expect(totalPot(state.hand)).toBe(120000);
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
    expect(totalPot(state.hand)).toBe(380000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3100000, 3110000, 770000, 1525000, 435000, 2060000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_5_00_13_47",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20000 },
      bringIn: 20000,
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3100000, 3110000, 770000, 1525000, 435000, 2060000],
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
    expect(totalPot(state.hand)).toBe(120000);
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
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(380000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3000000, 3310000, 750000, 1485000, 415000, 2040000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_6_00_15_43",
  () => {
    const game = stud.fixedLimitHiLo({
      antes: { kind: "everyone", amount: 20000 },
      bringIn: 20000,
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3000000, 3310000, 750000, 1485000, 415000, 2040000],
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
    expect(totalPot(state.hand)).toBe(120000);
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
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [burnCard, ...repeat(dealHole, 2), call, call]);
    expect(totalPot(state.hand)).toBe(300000);
    play(state, [
      burnCard,
      ...repeat(dealHole, 2),
      call,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(620000);
    play(state, [burnCard, ...repeat(dealHole, 2), raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(930000);
    play(state, [showOrMuck, showOrMuck, burnCard, ...repeat(dealHole, 2)]);
    expect(totalPot(state.hand)).toBe(930000);
    play(state, [showOrMuck, showOrMuck, killHand, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2980000, 3290000, 710000, 2000000, 0, 2020000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_7_00_20_03",
  () => {
    const game = holdem.fixedLimit({
      blinds: [80000],
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [2020000, 2980000, 3290000, 710000, 2000000],
        automation.none,
        deck("   ?? Js ?? 8d ??", "   ?? 3h ?? 7d ??")
      )
    );
    play(state, [postBlind]);
    expect(totalPot(state.hand)).toBe(80000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(240000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1940000, 2980000, 3290000, 790000, 2000000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_8_00_20_31",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40000, 80000],
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1940000, 2980000, 3290000, 790000, 2000000],
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
    expect(totalPot(state.hand)).toBe(120000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      fold,
      raise,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(320000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(480000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(800000);
    play(state, [burnCard, dealBoard, call, raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(960000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1540000, 3380000, 3290000, 790000, 2000000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_9_00_23_52",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40000, 80000],
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3380000, 3290000, 790000, 2000000, 1540000],
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
    expect(totalPot(state.hand)).toBe(120000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raise,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(360000);
    play(state, [burnCard, dealBoard, call, raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(680000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [burnCard, dealBoard, raise, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(1160000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3340000, 3810000, 790000, 2000000, 1060000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_10_00_26_43",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40000, 80000],
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3810000, 790000, 2000000, 1060000, 3340000],
        automation.none,
        deck("   Td 9s Kc Qs Tc", "   7c 3h 4c Qd 9d")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      raise,
      fold,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(280000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3770000, 710000, 2000000, 1180000, 3340000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_11_00_27_27",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40000, 80000],
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [710000, 2000000, 1180000, 3340000, 3770000],
        automation.none,
        deck("   7s Jh Qc Kc Ac", "   5h 3c 8h 5s 9s")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      fold,
      fold,
      raise,
      fold,
      fold,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(280000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      670000, 1920000, 1180000, 3340000, 3890000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_12_00_28_26",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40000, 80000],
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1920000, 1180000, 3340000, 3890000, 670000],
        automation.none,
        deck("   Ah 9d ?? 2s 6h", "   Js 9c ?? 2h 4h", "?? 8d3d6d")
      )
    );
    play(state, [postBlind, postBlind]);
    expect(totalPot(state.hand)).toBe(120000);
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
    expect(totalPot(state.hand)).toBe(960000);
    play(state, [burnCard, dealBoard, call, raise, fold, fold, collectBets]);
    expect(totalPot(state.hand)).toBe(1040000);
    play(state, [pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      1600000, 1820000, 3340000, 3570000, 670000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_13_00_31_44",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40000, 80000],
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [1820000, 3340000, 3570000, 670000, 1600000],
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
    expect(totalPot(state.hand)).toBe(120000);
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
    expect(totalPot(state.hand)).toBe(560000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(720000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1040000);
    play(state, [burnCard, dealBoard, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1360000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      2540000, 3260000, 3570000, 670000, 960000,
    ]);
    replaysTheSameHand(state.hand);
  }
);

unitTest(
  "pokerkit.tests.test_wsop.test_2023_54_4.StateTestCase.test_14_00_34_31",
  () => {
    const game = holdem.fixedLimit({
      blinds: [40000, 80000],
      smallBet: 80000,
      bigBet: 160000,
      anteTrimming: true,
    });
    const state = drive(
      start(
        game,
        [3260000, 3570000, 670000, 960000, 2540000],
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
    expect(totalPot(state.hand)).toBe(120000);
    play(state, [
      ...repeat(dealHole, 5 * 2),
      raise,
      fold,
      fold,
      fold,
      call,
      collectBets,
    ]);
    expect(totalPot(state.hand)).toBe(360000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(360000);
    play(state, [burnCard, dealBoard, call, raise, raise, call, collectBets]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [burnCard, dealBoard, call, call]);
    expect(totalPot(state.hand)).toBe(1000000);
    play(state, [showOrMuck, showOrMuck, pushChips, pullChips]);
    expect(totalPot(state.hand)).toBe(0);
    expect(stacks(state.hand)).toEqual([
      3220000, 4090000, 190000, 960000, 2540000,
    ]);
    replaysTheSameHand(state.hand);
  }
);
