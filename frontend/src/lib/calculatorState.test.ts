import { describe, expect, it } from "vitest";
import { evaluate } from "../mocks/handlers";
import { keyIdFor } from "./calculator";
import {
  displayOf,
  initialState,
  reducer,
  requestFor,
  type State,
} from "./calculatorState";

function run(keys: string, from: State = initialState): State {
  let state = from;
  for (const token of keys.split(" ")) {
    for (const keyName of keyIdFor(token) ? [token] : [...token]) {
      const id = keyIdFor(keyName)!;
      const request = requestFor(state, id);
      if (!request) {
        state = reducer(state, { type: "key", id });
        continue;
      }
      const answer = evaluate(request.call);
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
    ["0.12345678901234567", "0.1234567890"],
    ["1.123456789012", "1.1234567890"],
    ["12345678901234.56", "12345678901234.5"],
  ])("typing %s gives %s", (keys, text) => {
    expect(run(keys).text).toBe(text);
  });

  it("shows typed operands as typed, not formatted", () => {
    expect(shown("1234.5000 +")).toEqual(["1234.5000", "1234.5000 +"]);
  });

  it("replaces the display and drops the pending operator on a 400 error", () => {
    const failed = run("1 / 0 =");

    expect(displayOf(failed)).toEqual({
      pending: "",
      value: "Can’t divide by zero",
      isError: true,
    });
  });

  it.each(["+", "=", "r", ".", "Backspace"])(
    "keeps a 400 error when %s is pressed",
    (keys) => {
      const failed = run("1 / 0 =");

      expect(run(keys, failed).error).not.toBeNull();
    },
  );

  it("starts a new number when a digit follows a 400 error", () => {
    const failed = run("1 / 0 =");

    expect(displayOf(run("5", failed))).toMatchObject({
      value: "5",
      isError: false,
    });
  });

  it("clears a 400 error with C", () => {
    const failed = run("1 / 0 =");

    expect(run("Escape", failed).error).toBeNull();
  });
});
