import { expect } from "bun:test";

import { unitTest } from "../../../../parity/harness.ts";
import type { Automation, Hand } from "../../src/hand.ts";
import {
  formatPhh,
  historyFromHand,
  parsePhh,
  toAcpc,
  toPluribus,
  type AcpcMessage,
  type Phh,
} from "../../src/phh.ts";
import { ok } from "../../src/result.ts";
import { holdem } from "../../src/rules.ts";
import { readToml } from "../../src/toml.ts";
import {
  accept,
  drive,
  inProgress,
  moves,
  play,
  repeat,
  start,
  type Move,
} from "../driver.ts";
import { cards } from "../support.ts";

const { deal, board, burn, call, fold, raise, raiseTo } = moves;

const automate = [
  "antePosting",
  "betCollection",
  "blindPosting",
  "handKilling",
  "chipsPushing",
  "chipsPulling",
] as const satisfies Automation;

const fixedLimit = holdem.fixedLimit({
  blinds: [50, 100],
  smallBet: 100,
  bigBet: 200,
  anteTrimming: true,
});

const noLimit = holdem.noLimit({
  blinds: [50, 100],
  minBet: 100,
  anteTrimming: true,
});

function show(text: string): Move {
  return accept({ type: "show", cards: cards(text) });
}

function historyOf(hand: Hand): Phh {
  const history = historyFromHand(hand);
  if (!history.ok) throw new Error(JSON.stringify(history.error));
  return history.value;
}

function tomlOf(text: string) {
  const table = readToml(text);
  if (!table.ok) throw new Error(JSON.stringify(table.error));
  return table.value;
}

function parsed(text: string): Phh {
  const history = parsePhh(text);
  if (!history.ok) throw new Error(JSON.stringify(history.error));
  return history.value;
}

unitTest(
  "pokerkit.tests.test_notation.HandHistoryTestCase.test_user_fields",
  () => {
    const game = holdem.fixedLimit({
      blinds: [1, 2],
      smallBet: 2,
      bigBet: 4,
      anteTrimming: true,
    });
    const table = drive(start(game, repeat(200, 5), automate));
    play(table, [...repeat(deal("????"), 5), ...repeat(fold, 4)]);

    expect(inProgress(table.hand)).toBe(false);

    let hh = historyOf(table.hand);
    hh = {
      ...hh,
      extra: {
        ...hh.extra,
        key: { type: "string", value: "value" },
        _key: { type: "string", value: "_value" },
      },
    };

    expect(tomlOf(formatPhh(hh))["key"]).toBe("value");
    expect(tomlOf(formatPhh(hh))["_key"]).toBe("_value");

    hh = parsed(formatPhh(hh));

    expect(hh.extra["key"]).toEqual({ type: "string", value: "value" });
    expect(hh.extra["_key"]).toEqual({ type: "string", value: "_value" });
    expect(tomlOf(formatPhh(hh))["key"]).toBe("value");
    expect(tomlOf(formatPhh(hh))["_key"]).toBe("_value");
  }
);

unitTest(
  "pokerkit.tests.test_notation.HandHistoryTestCase.test_to_acpc_protocol_full",
  () => {
    let table = drive(start(fixedLimit, [20000, 20000], automate));
    play(table, [
      deal("TdAs"),
      deal("????"),
      raise,
      raise,
      call,
      burn,
      board("2c8c3h"),
      raise,
      call,
      burn,
      board("9c"),
      call,
      raise,
      call,
      burn,
      board("Kh"),
      call,
      raise,
      call,
      show("8hTc"),
      show("TdAs"),
    ]);

    expect(inProgress(table.hand)).toBe(false);

    let hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 0 })).toEqual(
      ok([
        ["S->", "MATCHSTATE:0:0::TdAs|\r\n"],
        ["S->", "MATCHSTATE:0:0:r:TdAs|\r\n"],
        ["<-C", "MATCHSTATE:0:0:r:TdAs|:r\r\n"],
        ["S->", "MATCHSTATE:0:0:rr:TdAs|\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/:TdAs|/2c8c3h\r\n"],
        ["<-C", "MATCHSTATE:0:0:rrc/:TdAs|/2c8c3h:r\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/r:TdAs|/2c8c3h\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/rc/:TdAs|/2c8c3h/9c\r\n"],
        ["<-C", "MATCHSTATE:0:0:rrc/rc/:TdAs|/2c8c3h/9c:c\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/rc/c:TdAs|/2c8c3h/9c\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/rc/cr:TdAs|/2c8c3h/9c\r\n"],
        ["<-C", "MATCHSTATE:0:0:rrc/rc/cr:TdAs|/2c8c3h/9c:c\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/rc/crc/:TdAs|/2c8c3h/9c/Kh\r\n"],
        ["<-C", "MATCHSTATE:0:0:rrc/rc/crc/:TdAs|/2c8c3h/9c/Kh:c\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/rc/crc/c:TdAs|/2c8c3h/9c/Kh\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/rc/crc/cr:TdAs|/2c8c3h/9c/Kh\r\n"],
        ["<-C", "MATCHSTATE:0:0:rrc/rc/crc/cr:TdAs|/2c8c3h/9c/Kh:c\r\n"],
        ["S->", "MATCHSTATE:0:0:rrc/rc/crc/crc:TdAs|8hTc/2c8c3h/9c/Kh\r\n"],
      ])
    );

    table = drive(start(fixedLimit, [20000, 20000], automate));
    play(table, [
      deal("????"),
      deal("Qd7c"),
      raise,
      raise,
      call,
      burn,
      board("2h8h5c"),
      raise,
      call,
      burn,
      board("Th"),
      raise,
      fold,
    ]);

    expect(inProgress(table.hand)).toBe(false);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 1, { handNumber: 1 })).toEqual(
      ok([
        ["S->", "MATCHSTATE:1:1::|Qd7c\r\n"],
        ["<-C", "MATCHSTATE:1:1::|Qd7c:r\r\n"],
        ["S->", "MATCHSTATE:1:1:r:|Qd7c\r\n"],
        ["S->", "MATCHSTATE:1:1:rr:|Qd7c\r\n"],
        ["<-C", "MATCHSTATE:1:1:rr:|Qd7c:c\r\n"],
        ["S->", "MATCHSTATE:1:1:rrc/:|Qd7c/2h8h5c\r\n"],
        ["S->", "MATCHSTATE:1:1:rrc/r:|Qd7c/2h8h5c\r\n"],
        ["<-C", "MATCHSTATE:1:1:rrc/r:|Qd7c/2h8h5c:c\r\n"],
        ["S->", "MATCHSTATE:1:1:rrc/rc/:|Qd7c/2h8h5c/Th\r\n"],
        ["S->", "MATCHSTATE:1:1:rrc/rc/r:|Qd7c/2h8h5c/Th\r\n"],
        ["<-C", "MATCHSTATE:1:1:rrc/rc/r:|Qd7c/2h8h5c/Th:f\r\n"],
        ["S->", "MATCHSTATE:1:1:rrc/rc/rf:|Qd7c/2h8h5c/Th\r\n"],
      ])
    );

    table = drive(start(fixedLimit, [20000, 20000], automate));
    play(table, [
      deal("9d7s"),
      deal("????"),
      raise,
      call,
      burn,
      board("5d2cJc"),
      call,
      call,
      burn,
      board("3d"),
      call,
      raise,
      fold,
    ]);

    expect(inProgress(table.hand)).toBe(false);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 2 })).toEqual(
      ok([
        ["S->", "MATCHSTATE:0:2::9d7s|\r\n"],
        ["S->", "MATCHSTATE:0:2:r:9d7s|\r\n"],
        ["<-C", "MATCHSTATE:0:2:r:9d7s|:c\r\n"],
        ["S->", "MATCHSTATE:0:2:rc/:9d7s|/5d2cJc\r\n"],
        ["<-C", "MATCHSTATE:0:2:rc/:9d7s|/5d2cJc:c\r\n"],
        ["S->", "MATCHSTATE:0:2:rc/c:9d7s|/5d2cJc\r\n"],
        ["S->", "MATCHSTATE:0:2:rc/cc/:9d7s|/5d2cJc/3d\r\n"],
        ["<-C", "MATCHSTATE:0:2:rc/cc/:9d7s|/5d2cJc/3d:c\r\n"],
        ["S->", "MATCHSTATE:0:2:rc/cc/c:9d7s|/5d2cJc/3d\r\n"],
        ["S->", "MATCHSTATE:0:2:rc/cc/cr:9d7s|/5d2cJc/3d\r\n"],
        ["<-C", "MATCHSTATE:0:2:rc/cc/cr:9d7s|/5d2cJc/3d:f\r\n"],
        ["S->", "MATCHSTATE:0:2:rc/cc/crf:9d7s|/5d2cJc/3d\r\n"],
      ])
    );

    table = drive(start(noLimit, [20000, 20000], automate));
    play(table, [
      deal("9s8h"),
      deal("????"),
      call,
      call,
      burn,
      board("8c8d5c"),
      raiseTo(150),
      call,
      burn,
      board("6s"),
      raiseTo(250),
      call,
      burn,
      board("2d"),
      raiseTo(750),
      call,
      show("9s8h"),
      show("9c6h"),
    ]);

    expect(inProgress(table.hand)).toBe(false);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 30 })).toEqual(
      ok([
        ["S->", "MATCHSTATE:0:30::9s8h|\r\n"],
        ["S->", "MATCHSTATE:0:30:c:9s8h|\r\n"],
        ["<-C", "MATCHSTATE:0:30:c:9s8h|:c\r\n"],
        ["S->", "MATCHSTATE:0:30:cc/:9s8h|/8c8d5c\r\n"],
        ["<-C", "MATCHSTATE:0:30:cc/:9s8h|/8c8d5c:r250\r\n"],
        ["S->", "MATCHSTATE:0:30:cc/r250:9s8h|/8c8d5c\r\n"],
        ["S->", "MATCHSTATE:0:30:cc/r250c/:9s8h|/8c8d5c/6s\r\n"],
        ["<-C", "MATCHSTATE:0:30:cc/r250c/:9s8h|/8c8d5c/6s:r500\r\n"],
        ["S->", "MATCHSTATE:0:30:cc/r250c/r500:9s8h|/8c8d5c/6s\r\n"],
        ["S->", "MATCHSTATE:0:30:cc/r250c/r500c/:9s8h|/8c8d5c/6s/2d\r\n"],
        [
          "<-C",
          "MATCHSTATE" +
            ":0" +
            ":30" +
            ":cc/r250c/r500c/" +
            ":9s8h|/8c8d5c/6s/2d:r1250" +
            "\r\n",
        ],
        [
          "S->",
          "MATCHSTATE" +
            ":0" +
            ":30" +
            ":cc/r250c/r500c/r1250" +
            ":9s8h|/8c8d5c/6s/2d" +
            "\r\n",
        ],
        [
          "S->",
          "MATCHSTATE" +
            ":0" +
            ":30" +
            ":cc/r250c/r500c/r1250c" +
            ":9s8h|9c6h/8c8d5c/6s/2d" +
            "\r\n",
        ],
      ])
    );

    table = drive(start(noLimit, [20000, 20000], automate));
    play(table, [
      deal("????"),
      deal("JdTc"),
      raiseTo(300),
      raiseTo(900),
      call,
      burn,
      board("6dJc9c"),
      raiseTo(900),
      raiseTo(2700),
      raiseTo(8100),
      call,
      burn,
      board("Kh"),
      raiseTo(11000),
      call,
      show("KsJs"),
      show("JdTc"),
      burn,
      board("Qc"),
    ]);

    expect(inProgress(table.hand)).toBe(false);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 1, { handNumber: 31 })).toEqual(
      ok([
        ["S->", "MATCHSTATE:1:31::|JdTc\r\n"],
        ["<-C", "MATCHSTATE:1:31::|JdTc:r300\r\n"],
        ["S->", "MATCHSTATE:1:31:r300:|JdTc\r\n"],
        ["S->", "MATCHSTATE:1:31:r300r900:|JdTc\r\n"],
        ["<-C", "MATCHSTATE:1:31:r300r900:|JdTc:c\r\n"],
        ["S->", "MATCHSTATE:1:31:r300r900c/:|JdTc/6dJc9c\r\n"],
        ["S->", "MATCHSTATE:1:31:r300r900c/r1800:|JdTc/6dJc9c\r\n"],
        ["<-C", "MATCHSTATE:1:31:r300r900c/r1800:|JdTc/6dJc9c:r3600\r\n"],
        ["S->", "MATCHSTATE:1:31:r300r900c/r1800r3600:|JdTc/6dJc9c\r\n"],
        [
          "S->",
          "MATCHSTATE" +
            ":1" +
            ":31" +
            ":r300r900c/r1800r3600r9000" +
            ":|JdTc/6dJc9c" +
            "\r\n",
        ],
        [
          "<-C",
          "MATCHSTATE" +
            ":1" +
            ":31" +
            ":r300r900c/r1800r3600r9000" +
            ":|JdTc/6dJc9c:c" +
            "\r\n",
        ],
        [
          "S->",
          "MATCHSTATE" +
            ":1" +
            ":31" +
            ":r300r900c/r1800r3600r9000c/" +
            ":|JdTc/6dJc9c/Kh" +
            "\r\n",
        ],
        [
          "S->",
          "MATCHSTATE" +
            ":1" +
            ":31" +
            ":r300r900c/r1800r3600r9000c/r20000" +
            ":|JdTc/6dJc9c/Kh" +
            "\r\n",
        ],
        [
          "<-C",
          "MATCHSTATE" +
            ":1" +
            ":31" +
            ":r300r900c/r1800r3600r9000c/r20000" +
            ":|JdTc/6dJc9c/Kh:c" +
            "\r\n",
        ],
        [
          "S->",
          "MATCHSTATE" +
            ":1" +
            ":31" +
            ":r300r900c/r1800r3600r9000c/r20000c/" +
            ":KsJs|JdTc/6dJc9c/Kh/Qc" +
            "\r\n",
        ],
      ])
    );

    table = drive(start(fixedLimit, [20000, 20000, 20000], automate));
    play(table, [
      deal("????"),
      deal("????"),
      deal("AsTs"),
      raise,
      call,
      call,
      burn,
      board("4cJh8h"),
      raise,
      fold,
      call,
      burn,
      board("Kd"),
      raise,
      call,
      burn,
      board("8c"),
      raise,
      fold,
    ]);

    expect(inProgress(table.hand)).toBe(false);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 2, { handNumber: 55 })).toEqual(
      ok([
        ["S->", "MATCHSTATE:2:55::||AsTs\r\n"],
        ["<-C", "MATCHSTATE:2:55::||AsTs:r\r\n"],
        ["S->", "MATCHSTATE:2:55:r:||AsTs\r\n"],
        ["S->", "MATCHSTATE:2:55:rc:||AsTs\r\n"],
        ["S->", "MATCHSTATE:2:55:rcc/:||AsTs/4cJh8h\r\n"],
        ["S->", "MATCHSTATE:2:55:rcc/r:||AsTs/4cJh8h\r\n"],
        ["S->", "MATCHSTATE:2:55:rcc/rf:||AsTs/4cJh8h\r\n"],
        ["<-C", "MATCHSTATE:2:55:rcc/rf:||AsTs/4cJh8h:c\r\n"],
        ["S->", "MATCHSTATE:2:55:rcc/rfc/:||AsTs/4cJh8h/Kd\r\n"],
        ["S->", "MATCHSTATE:2:55:rcc/rfc/r:||AsTs/4cJh8h/Kd\r\n"],
        ["<-C", "MATCHSTATE:2:55:rcc/rfc/r:||AsTs/4cJh8h/Kd:c\r\n"],
        ["S->", "MATCHSTATE:2:55:rcc/rfc/rc/:||AsTs/4cJh8h/Kd/8c\r\n"],
        ["S->", "MATCHSTATE:2:55:rcc/rfc/rc/r:||AsTs/4cJh8h/Kd/8c\r\n"],
        ["<-C", "MATCHSTATE:2:55:rcc/rfc/rc/r:||AsTs/4cJh8h/Kd/8c:f\r\n"],
        ["S->", "MATCHSTATE:2:55:rcc/rfc/rc/rf:||AsTs/4cJh8h/Kd/8c\r\n"],
      ])
    );

    table = drive(start(fixedLimit, [20000, 20000, 20000], automate));
    play(table, [
      deal("Ad6h"),
      deal("????"),
      deal("????"),
      call,
      raise,
      fold,
      call,
      burn,
      board("TsKd7h"),
      raise,
      call,
      burn,
      board("Kh"),
      raise,
      call,
      burn,
      board("6d"),
      raise,
      call,
      show("Ad6h"),
      show("Td2h"),
    ]);

    expect(inProgress(table.hand)).toBe(false);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 90 })).toEqual(
      ok([
        ["S->", "MATCHSTATE:0:90::Ad6h||\r\n"],
        ["S->", "MATCHSTATE:0:90:c:Ad6h||\r\n"],
        ["<-C", "MATCHSTATE:0:90:c:Ad6h||:r\r\n"],
        ["S->", "MATCHSTATE:0:90:cr:Ad6h||\r\n"],
        ["S->", "MATCHSTATE:0:90:crf:Ad6h||\r\n"],
        ["S->", "MATCHSTATE:0:90:crfc/:Ad6h||/TsKd7h\r\n"],
        ["<-C", "MATCHSTATE:0:90:crfc/:Ad6h||/TsKd7h:r\r\n"],
        ["S->", "MATCHSTATE:0:90:crfc/r:Ad6h||/TsKd7h\r\n"],
        ["S->", "MATCHSTATE:0:90:crfc/rc/:Ad6h||/TsKd7h/Kh\r\n"],
        ["<-C", "MATCHSTATE:0:90:crfc/rc/:Ad6h||/TsKd7h/Kh:r\r\n"],
        ["S->", "MATCHSTATE:0:90:crfc/rc/r:Ad6h||/TsKd7h/Kh\r\n"],
        ["S->", "MATCHSTATE:0:90:crfc/rc/rc/:Ad6h||/TsKd7h/Kh/6d\r\n"],
        ["<-C", "MATCHSTATE:0:90:crfc/rc/rc/:Ad6h||/TsKd7h/Kh/6d:r\r\n"],
        ["S->", "MATCHSTATE:0:90:crfc/rc/rc/r:Ad6h||/TsKd7h/Kh/6d\r\n"],
        [
          "S->",
          "MATCHSTATE" +
            ":0" +
            ":90" +
            ":crfc/rc/rc/rc" +
            ":Ad6h||Td2h/TsKd7h/Kh/6d" +
            "\r\n",
        ],
      ])
    );
  }
);

unitTest(
  "pokerkit.tests.test_notation.HandHistoryTestCase.test_to_acpc_protocol_partial",
  () => {
    const interactions = [
      ["S->", "MATCHSTATE:0:0::TdAs|\r\n"],
      ["S->", "MATCHSTATE:0:0:r:TdAs|\r\n"],
      ["<-C", "MATCHSTATE:0:0:r:TdAs|:r\r\n"],
      ["S->", "MATCHSTATE:0:0:rr:TdAs|\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/:TdAs|/2c8c3h\r\n"],
      ["<-C", "MATCHSTATE:0:0:rrc/:TdAs|/2c8c3h:r\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/r:TdAs|/2c8c3h\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/rc/:TdAs|/2c8c3h/9c\r\n"],
      ["<-C", "MATCHSTATE:0:0:rrc/rc/:TdAs|/2c8c3h/9c:c\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/rc/c:TdAs|/2c8c3h/9c\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/rc/cr:TdAs|/2c8c3h/9c\r\n"],
      ["<-C", "MATCHSTATE:0:0:rrc/rc/cr:TdAs|/2c8c3h/9c:c\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/rc/crc/:TdAs|/2c8c3h/9c/Kh\r\n"],
      ["<-C", "MATCHSTATE:0:0:rrc/rc/crc/:TdAs|/2c8c3h/9c/Kh:c\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/rc/crc/c:TdAs|/2c8c3h/9c/Kh\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/rc/crc/cr:TdAs|/2c8c3h/9c/Kh\r\n"],
      ["<-C", "MATCHSTATE:0:0:rrc/rc/crc/cr:TdAs|/2c8c3h/9c/Kh:c\r\n"],
      ["S->", "MATCHSTATE:0:0:rrc/rc/crc/crc:TdAs|8hTc/2c8c3h/9c/Kh\r\n"],
    ] satisfies AcpcMessage[];
    const table = drive(start(fixedLimit, [20000, 20000], automate));
    play(table, [
      deal("TdAs"),
      deal("????"),
      raise,
      raise,
      call,
      burn,
      board("2c8c3h"),
      raise,
      call,
      burn,
      board("9c"),
      call,
      raise,
    ]);

    let hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 0 })).toEqual(
      ok(interactions.slice(0, -7))
    );

    play(table, [call, burn, board("Kh")]);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 0 })).toEqual(
      ok(interactions.slice(0, -5))
    );

    call(table);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 0 })).toEqual(
      ok(interactions.slice(0, -3))
    );

    raise(table);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 0 })).toEqual(
      ok(interactions.slice(0, -2))
    );

    play(table, [call, show("8hTc"), show("TdAs")]);

    hh = historyOf(table.hand);

    expect(toAcpc(hh, 0, { handNumber: 0 })).toEqual(ok(interactions));
  }
);

unitTest(
  "pokerkit.tests.test_notation.HandHistoryTestCase.test_to_pluribus_protocol",
  () => {
    const shownAutomatically = [
      ...automate,
      "holeCardsShowingOrMucking",
    ] as const satisfies Automation;
    let table = drive(start(noLimit, repeat(10000, 6), shownAutomatically));
    play(table, [
      deal("8d5h"),
      deal("6sTs"),
      deal("4d9h"),
      deal("7c7d"),
      deal("4sQc"),
      deal("KhKc"),
      fold,
      raiseTo(225),
      fold,
      raiseTo(700),
      fold,
      fold,
      call,
      burn,
      board("4c2s7h"),
      call,
      raiseTo(555),
      call,
      burn,
      board("Js"),
      call,
      raiseTo(1750),
      call,
      burn,
      board("2h"),
      call,
      raiseTo(6995),
      call,
    ]);

    expect(inProgress(table.hand)).toBe(false);

    let hh: Phh = {
      ...historyOf(table.hand),
      players: ["Hattori", "MrBlue", "Pluribus", "Budd", "MrWhite", "MrOrange"],
    };

    expect(toPluribus(hh, { handNumber: 33 })).toEqual(
      ok(
        "STATE" +
          ":33" +
          ":fr225fr700ffc/cr1255c/cr3005c/cr10000c" +
          ":8d5h|6sTs|4d9h|7c7d|4sQc|KhKc/4c2s7h/Js/2h" +
          ":-50|-100|0|10150|0|-10000" +
          ":Hattori|MrBlue|Pluribus|Budd|MrWhite|MrOrange"
      )
    );

    table = drive(start(noLimit, repeat(10000, 6), shownAutomatically));
    play(table, [
      deal("4sAd"),
      deal("3h6d"),
      deal("9hJd"),
      deal("7s7d"),
      deal("KhTd"),
      deal("Tc4d"),
      fold,
      raiseTo(200),
      fold,
      fold,
      fold,
      fold,
    ]);

    expect(inProgress(table.hand)).toBe(false);

    hh = {
      ...historyOf(table.hand),
      players: ["MrOrange", "Hattori", "MrBlue", "Pluribus", "Budd", "MrWhite"],
    };

    expect(toPluribus(hh, { handNumber: 38 })).toEqual(
      ok(
        "STATE" +
          ":38" +
          ":fr200ffff" +
          ":4sAd|3h6d|9hJd|7s7d|KhTd|Tc4d" +
          ":-50|-100|0|150|0|0" +
          ":MrOrange|Hattori|MrBlue|Pluribus|Budd|MrWhite"
      )
    );
  }
);
