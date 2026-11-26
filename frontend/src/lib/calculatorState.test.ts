import { describe, expect, it } from "vitest";
import { evaluate } from "../test/backend";
import { keyIdFor } from "./calculator";
import {
  displayOf,
  initialState,
  reducer,
  requestFor,
  type State,
} from "./calculatorState";

function run(keys: string, from: State = initialState()): State {
  let state = from;
  for (const token of keys.split(" ")) {
    for (const keyName of keyIdFor(token) ? [token] : [...token]) {
      const id = keyIdFor(keyName)!;
      const request = requestFor(state, id);
      if (!request) {
        state = reducer(state, { type: "key", id });
        continue;
      }
      const answer = evaluate(
        request.operation,
        request.firstOperand,
        request.secondOperand,
      );
      state = reducer(
        state,
        "error" in answer
          ? { type: "rejected", message: answer.error }
          : { type: "succeeded", request, result: answer.result },
      );
    }
  }
  return state;
}

const shown = (keys: string) => {
  const { value, pending } = displayOf(run(keys));
  return [value, pending];
};

describe("calculator state", () => {
  it.each([
    ["2 + 3 =", ["5", "2 + 3 ="]],
    ["2 + 3 *", ["5", "5 ×"]],
    ["2 + *", ["2", "2 ×"]],
    ["9 r", ["3", ""]],
    ["80 * 15 % =", ["12", "80 × 0.15 ="]],
    ["2 + 9 r =", ["5", "2 + 3 ="]],
    ["2 + 3 = 7", ["7", ""]],
    ["2 + 3 = * 4 =", ["20", "5 × 4 ="]],
    ["5 + 3 Delete", ["0", "5 +"]],
    ["5 + 3 Delete 4 =", ["9", "5 + 4 ="]],
    ["123 Backspace", ["12", ""]],
    ["1 Backspace Backspace", ["0", ""]],
    ["2 + 3 = Backspace", ["5", "2 + 3 ="]],
    ["5 + 3 Escape", ["0", ""]],
  ])("%s shows %j", (keys, expected) => {
    expect(shown(keys)).toEqual(expected);
  });

  it.each([
    ["1.2.3", "1.23"],
    [". 5", "0.5"],
    ["007", "7"],
    ["1234567890123456", "123456789012345"],
  ])("typing %s gives %s", (keys, text) => {
    expect(run(keys).text).toBe(text);
  });

  it("shows typed operands as typed, not rounded", () => {
    expect(shown("0.00000000001 +")).toEqual([
      "0.00000000001",
      "0.00000000001 +",
    ]);
  });

  it("shows a 400 message, drops the operator and recovers only by digit, C or CE", () => {
    const failed = run("1 / 0 =");

    expect(displayOf(failed)).toEqual({
      pending: "",
      value: "Can’t divide by zero",
      isError: true,
    });
    expect(run("+ = r . Backspace", failed).error).not.toBeNull();
    expect(displayOf(run("5", failed))).toMatchObject({
      value: "5",
      isError: false,
    });
    expect(run("Delete", failed).error).toBeNull();
    expect(run("Escape", failed).error).toBeNull();
  });

  it("keeps the 8 newest calculations", () => {
    const state = run("1 + 1 = ".repeat(8) + "9 r");

    expect(state.history).toHaveLength(8);
    expect(state.history[0]).toEqual({ expr: "√9", result: 3 });
    expect(run("15 %").history[0].expr).toBe("15%");
  });

  it("loads a history result as a fresh number, or as the second operand", () => {
    expect(
      displayOf(reducer(run("7"), { type: "reuse", result: 1234.5 })).value,
    ).toBe("1,234.5");

    const reused = reducer(run("2 +"), { type: "reuse", result: 8 });
    expect(displayOf(run("=", reused)).value).toBe("10");
  });
});
