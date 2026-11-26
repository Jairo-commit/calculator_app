import { describe, expect, it } from "vitest";
import {
  KEYPAD,
  OP_SYMBOLS,
  formatResult,
  isBinaryOp,
  isUnaryOp,
  keyIdForPhysicalKey,
} from "./calculator";

describe("formatResult", () => {
  it.each([
    [1000, "1,000"],
    [187.5, "187.5"],
    [-4, "−4"],
    [1 / 3, "0.3333333333"],
    [0, "0"],
  ])("formats %d as %s", (n, text) => {
    expect(formatResult(n)).toBe(text);
  });
});

describe("operations", () => {
  it("tells binary, unary and other ids apart", () => {
    expect(isBinaryOp("power")).toBe(true);
    expect(isBinaryOp("sqrt")).toBe(false);
    expect(isUnaryOp("percent")).toBe(true);
    expect(isUnaryOp("add")).toBe(false);
    expect(isUnaryOp("equals")).toBe(false);
  });

  it("has a symbol for every binary operation", () => {
    expect(OP_SYMBOLS).toEqual({
      add: "+",
      subtract: "−",
      multiply: "×",
      divide: "÷",
      power: "^",
    });
  });
});

describe("KEYPAD", () => {
  it("has 22 keys in grid order", () => {
    expect(KEYPAD.map((k) => k.label).join(" ")).toBe(
      "C CE ⌫ ÷ √ xʸ % × 7 8 9 − 4 5 6 + 1 2 3 = 0 .",
    );
  });

  it("has unique ids and an aria-label on every key", () => {
    expect(new Set(KEYPAD.map((k) => k.id)).size).toBe(KEYPAD.length);
    for (const key of KEYPAD) expect(key.ariaLabel).not.toBe("");
  });

  it("makes = span two rows and 0 span two columns", () => {
    expect(KEYPAD.filter((k) => k.rowSpan === 2).map((k) => k.label)).toEqual([
      "=",
    ]);
    expect(KEYPAD.filter((k) => k.span === 2).map((k) => k.label)).toEqual([
      "0",
    ]);
  });

  it("assigns kinds as in the spec", () => {
    const kinds = Object.fromEntries(KEYPAD.map((k) => [k.label, k.kind]));
    expect(kinds).toMatchObject({
      C: "clear",
      CE: "util",
      "⌫": "util",
      "√": "fn",
      xʸ: "fn",
      "%": "fn",
      "÷": "op",
      "×": "op",
      "−": "op",
      "+": "op",
      "7": "num",
      ".": "num",
      "=": "equals",
    });
  });
});

describe("keyIdForPhysicalKey", () => {
  it.each([
    ["7", "7"],
    [".", "decimal"],
    ["+", "add"],
    ["-", "subtract"],
    ["*", "multiply"],
    ["/", "divide"],
    ["^", "power"],
    ["Enter", "equals"],
    ["=", "equals"],
    ["Backspace", "backspace"],
    ["Delete", "clearEntry"],
    ["Escape", "clear"],
    ["r", "sqrt"],
    ["%", "percent"],
  ])("maps %s to %s", (key, id) => {
    expect(keyIdForPhysicalKey(key)).toBe(id);
  });

  it("ignores keys the calculator does not use", () => {
    expect(keyIdForPhysicalKey("a")).toBeNull();
    expect(keyIdForPhysicalKey("Tab")).toBeNull();
    expect(keyIdForPhysicalKey("10")).toBeNull();
  });
});
