import { describe, expect, it } from "vitest";
import fixture from "../../../backend/calc/testdata/cases.json";
import {
  CalcError,
  ERRORS,
  KEYPAD,
  MAX_EXPRESSION_LENGTH,
  evaluate,
  formatResult,
  liveError,
  preview,
} from "./calculator";

describe("shared fixture", () => {
  it("has the same error catalog as the Go engine", () => {
    expect(ERRORS).toEqual(fixture.messages);
  });

  it.each(fixture.cases.map((c) => [c.expr.slice(0, 40), c] as const))(
    "evaluates %j",
    (_name, c) => {
      if ("error" in c) {
        const error = (() => {
          try {
            evaluate(c.expr);
          } catch (e) {
            return e;
          }
        })();
        expect(error).toBeInstanceOf(CalcError);
        expect((error as CalcError).message).toBe(c.error);
      } else {
        expect(evaluate(c.expr)).toBe(c.result);
      }
    },
  );
});

describe("evaluate", () => {
  it("never returns negative zero", () => {
    expect(Object.is(evaluate("0 × −1"), 0)).toBe(true);
    expect(Object.is(evaluate("−0.00000000001"), 0)).toBe(true);
  });

  it("counts the length cap in code points, not bytes", () => {
    expect(MAX_EXPRESSION_LENGTH).toBe(200);
    expect(() => evaluate("1".repeat(201))).toThrow(ERRORS.TOO_LONG);
    expect(evaluate("1×".repeat(99) + "11")).toBe(11);
  });

  it("rounds negatives symmetrically", () => {
    expect(evaluate("−0.12345678905")).toBe(-evaluate("0.12345678905"));
  });

  it("reports the position of the offending token", () => {
    try {
      evaluate("2 + a");
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: "INVALID_CHAR", pos: 4 });
    }
  });
});

describe("liveError", () => {
  it.each(["12 +", "(8 + 2", "√", ".", "5 + .", "2 s", "2 sq", "2 sqr", ""])(
    "stays quiet for %j",
    (input) => {
      expect(liveError(input)).toBeNull();
    },
  );

  it.each([
    ["1.2.3", ERRORS.MULTI_DECIMAL],
    ["2 + a", ERRORS.INVALID_CHAR],
    [". + 1", ERRORS.BARE_DECIMAL],
    ["s5", ERRORS.INVALID_CHAR],
    ["1".repeat(201), ERRORS.TOO_LONG],
  ])("reports %j", (input, message) => {
    expect(liveError(input)?.message).toBe(message);
  });
});

describe("preview and formatResult", () => {
  it("returns null for incomplete or empty input", () => {
    expect(preview("12 +")).toBeNull();
    expect(preview("")).toBeNull();
  });

  it("previews the section 12 expression", () => {
    expect(preview("√144 + 2 ^ 3 × 50%")).toBe("16");
  });

  it.each([
    [1000, "1,000"],
    [187.5, "187.5"],
    [-4, "−4"],
    [1 / 3, "0.3333333333"],
  ])("formats %d as %s", (n, text) => {
    expect(formatResult(n)).toBe(text);
  });
});

describe("KEYPAD", () => {
  it("has 23 keys in grid order", () => {
    expect(KEYPAD.map((k) => k.label).join(" ")).toBe(
      "C ( ) ⌫ √ xʸ % ÷ 7 8 9 × 4 5 6 − 1 2 3 + 0 . =",
    );
  });

  it("gives every key an aria-label and only = spans two columns", () => {
    for (const key of KEYPAD) expect(key.ariaLabel).not.toBe("");
    expect(KEYPAD.filter((k) => k.span === 2).map((k) => k.label)).toEqual([
      "=",
    ]);
  });

  it("assigns kinds as in the spec", () => {
    const kinds = Object.fromEntries(KEYPAD.map((k) => [k.label, k.kind]));
    expect(kinds).toMatchObject({
      C: "clear",
      "(": "util",
      ")": "util",
      "⌫": "util",
      "√": "fn",
      xʸ: "fn",
      "%": "fn",
      "÷": "op",
      "+": "op",
      "7": "num",
      ".": "num",
      "=": "equals",
    });
  });
});
