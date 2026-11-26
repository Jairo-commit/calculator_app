import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeyId } from "../lib/calculator";
import { HISTORY_KEY } from "../lib/history";
import { api } from "../api/calculate";
import {
  bodyOf,
  fakeBackend,
  networkError,
  pathOf,
  reply,
  type Adapter,
} from "../test/fakeBackend";
import { createQueryWrapper } from "../test/queryWrapper";
import {
  MAX_DIGITS,
  initialState,
  reducer,
  requestForKey,
  useCalculator,
  type CalculatorState,
} from "./useCalculator";

/** The faked HTTP layer: every request of a test goes through it. */
let backend: ReturnType<typeof vi.fn<Adapter>>;

beforeEach(() => {
  backend = vi.fn<Adapter>(fakeBackend);
  api.defaults.adapter = backend;
});

type Hook = { current: ReturnType<typeof useCalculator> };

/** Presses keys one by one, waiting for any request they start to finish. */
async function press(result: Hook, ...ids: KeyId[]) {
  for (const id of ids) {
    await act(async () => {
      result.current.press(id);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
  }
}

const digits = (text: string): KeyId[] =>
  [...text].map((c) => (c === "." ? "decimal" : (c as KeyId)));

function setup() {
  return renderHook(() => useCalculator(), { wrapper: createQueryWrapper() })
    .result;
}

const bodyOfCall = (call: number) => bodyOf(backend.mock.calls[call][0]);
const pathOfCall = (call: number) => pathOf(backend.mock.calls[call][0]);

describe("typing a number", () => {
  it("starts at 0 and replaces it with the first digit", () => {
    const result = setup();
    expect(result.current.display.value).toBe("0");

    act(() => result.current.press("7"));

    expect(result.current.display.value).toBe("7");
  });

  it("allows one decimal point and avoids leading zeros", async () => {
    const result = setup();

    await press(result, "0", "0", "decimal", "5", "decimal", "2");

    expect(result.current.display.value).toBe("0.52");
  });

  it("starts a number with a bare point as 0.", async () => {
    const result = setup();

    await press(result, "decimal", "5");

    expect(result.current.display.value).toBe("0.5");
  });

  it("caps the entry at 15 digits", async () => {
    const result = setup();

    await press(result, ...digits("1234567890123456789"));

    expect(result.current.display.value).toBe("123456789012345");
    expect(MAX_DIGITS).toBe(15);
  });

  it("backspace removes the last character and falls back to 0", async () => {
    const result = setup();

    await press(result, "1", "2", "backspace");
    expect(result.current.display.value).toBe("1");
    await press(result, "backspace", "backspace");

    expect(result.current.display.value).toBe("0");
  });
});

describe("binary operations", () => {
  it("2 + 3 = calls /api/add once and shows 5", async () => {
    const result = setup();

    await press(result, "2", "add", "3", "equals");

    expect(backend).toHaveBeenCalledTimes(1);
    expect(pathOfCall(0)).toBe("/api/add");
    expect(bodyOfCall(0)).toEqual({ a: 2, b: 3 });
    expect(result.current.display).toEqual({
      pending: "2 + 3 =",
      value: "5",
      isError: false,
    });
  });

  it("2 + 3 × shows 5 with the pending line 5 ×", async () => {
    const result = setup();

    await press(result, "2", "add", "3", "multiply");

    expect(backend).toHaveBeenCalledTimes(1);
    expect(result.current.display.value).toBe("5");
    expect(result.current.display.pending).toBe("5 ×");
  });

  it("shows the pending line while the second number is typed", async () => {
    const result = setup();

    await press(result, "5", "add");
    expect(result.current.display).toMatchObject({
      pending: "5 +",
      value: "5",
    });

    await press(result, "8");
    expect(result.current.display).toMatchObject({
      pending: "5 +",
      value: "8",
    });
    expect(backend).not.toHaveBeenCalled();
  });

  it("2 + × only swaps the pending operation, with no request", async () => {
    const result = setup();

    await press(result, "2", "add", "multiply");

    expect(backend).not.toHaveBeenCalled();
    expect(result.current.display.pending).toBe("2 ×");
    await press(result, "4", "equals");
    expect(pathOfCall(0)).toBe("/api/multiply");
    expect(result.current.display.value).toBe("8");
  });

  it("= with nothing pending, or no second number, does nothing", async () => {
    const result = setup();

    await press(result, "equals", "2", "equals", "add", "equals");

    expect(backend).not.toHaveBeenCalled();
    expect(result.current.display).toMatchObject({
      pending: "2 +",
      value: "2",
    });
  });

  it("starts a fresh number after = and continues from the result with an operator", async () => {
    const result = setup();
    await press(result, "2", "add", "3", "equals");

    await press(result, "multiply", "2", "equals");
    expect(result.current.display.value).toBe("10");

    await press(result, "7");
    expect(result.current.display).toMatchObject({ pending: "", value: "7" });
  });

  it("raises to a power with xʸ", async () => {
    const result = setup();

    await press(result, "2", "power", "1", "0", "equals");

    expect(pathOfCall(0)).toBe("/api/power");
    expect(result.current.display.value).toBe("1,024");
  });
});

describe("unary operations", () => {
  it("9 √ shows 3 right away", async () => {
    const result = setup();

    await press(result, "9", "sqrt");

    expect(pathOfCall(0)).toBe("/api/sqrt");
    expect(bodyOfCall(0)).toEqual({ a: 9 });
    expect(result.current.display.value).toBe("3");
  });

  it("80 × 15 % = gives 12", async () => {
    const result = setup();

    await press(result, "8", "0", "multiply", "1", "5", "percent");
    expect(result.current.display.value).toBe("0.15");
    await press(result, "equals");

    expect(result.current.display.value).toBe("12");
    expect(bodyOfCall(1)).toEqual({ a: 80, b: 0.15 });
  });

  it("2 + 9 √ = gives 5", async () => {
    const result = setup();

    await press(result, "2", "add", "9", "sqrt", "equals");

    expect(result.current.display.value).toBe("5");
  });
});

describe("CE and C", () => {
  it("CE clears the entry but keeps the pending operation", async () => {
    const result = setup();

    await press(result, "5", "add", "9", "clearEntry");
    expect(result.current.display).toMatchObject({
      pending: "5 +",
      value: "0",
    });
    await press(result, "3", "equals");

    expect(result.current.display.value).toBe("8");
  });

  it("C resets everything", async () => {
    const result = setup();

    await press(result, "5", "add", "9", "clear");

    expect(result.current.display).toEqual({
      pending: "",
      value: "0",
      isError: false,
    });
  });
});

describe("errors from the server", () => {
  it("shows the message for ÷0, ignores keys other than digits, C and CE, then recovers", async () => {
    const result = setup();

    await press(result, "1", "divide", "0", "equals");
    expect(result.current.display).toEqual({
      pending: "",
      value: "Can’t divide by zero",
      isError: true,
    });

    await press(result, "add", "equals", "sqrt", "backspace", "percent");
    expect(result.current.display.isError).toBe(true);
    expect(backend).toHaveBeenCalledTimes(1);

    await press(result, "4");
    expect(result.current.display).toEqual({
      pending: "",
      value: "4",
      isError: false,
    });
  });

  it.each(["clearEntry", "clear"] as const)(
    "%s dismisses the error",
    async (id) => {
      const result = setup();
      await press(result, "1", "divide", "0", "equals");

      await press(result, id);

      expect(result.current.display).toMatchObject({
        value: "0",
        isError: false,
      });
    },
  );

  it("drops the pending operation on an error", async () => {
    const result = setup();
    await press(result, "1", "divide", "0", "equals", "5", "equals");

    expect(result.current.display).toMatchObject({ pending: "", value: "5" });
    expect(backend).toHaveBeenCalledTimes(1);
  });
});

describe("server unavailable", () => {
  it("opens the snackbar, keeps the state, and Retry applies the result", async () => {
    backend.mockImplementationOnce(networkError);
    const result = setup();

    await press(result, "2", "add", "3", "equals");

    expect(result.current.serverErrorOpen).toBe(true);
    expect(result.current.display).toMatchObject({
      pending: "2 +",
      value: "3",
    });

    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.display.value).toBe("5"));

    expect(result.current.serverErrorOpen).toBe(false);
    expect(backend).toHaveBeenCalledTimes(2);
    expect(bodyOfCall(1)).toEqual({ a: 2, b: 3 });
    expect(result.current.display.pending).toBe("2 + 3 =");
  });

  it("treats a 500 like a network failure and can dismiss the snackbar", async () => {
    backend.mockImplementationOnce((c) =>
      reply(c, 500, { error: "Internal server error" }),
    );
    const result = setup();

    await press(result, "1", "add", "1", "equals");
    expect(result.current.serverErrorOpen).toBe(true);
    act(() => result.current.dismissServerError());

    expect(result.current.serverErrorOpen).toBe(false);
    expect(result.current.display.value).toBe("1");
  });

  it("Retry with nothing to retry does not send a request", () => {
    const result = setup();

    act(() => result.current.retry());

    expect(backend).not.toHaveBeenCalled();
  });
});

describe("loading", () => {
  it("ignores every key except C while a request is in flight", async () => {
    let finish: () => void = () => {};
    backend.mockImplementationOnce(
      (c) =>
        new Promise((resolve) => {
          finish = () => resolve(reply(c, 200, { result: 5 }));
        }),
    );
    const result = setup();
    await press(result, "2", "add", "3");

    act(() => result.current.press("equals"));
    await waitFor(() => expect(result.current.loading).toBe(true));
    act(() => {
      result.current.press("7");
      result.current.press("equals");
      result.current.press("sqrt");
      result.current.press("backspace");
    });

    expect(backend).toHaveBeenCalledTimes(1);
    expect(result.current.display.value).toBe("3");

    await act(async () => finish());
    await waitFor(() => expect(result.current.display.value).toBe("5"));
  });

  it("C abandons the request in flight and the late answer is ignored", async () => {
    let finish: () => void = () => {};
    backend.mockImplementationOnce(
      (c) =>
        new Promise((resolve) => {
          finish = () => resolve(reply(c, 200, { result: 5 }));
        }),
    );
    const result = setup();
    await press(result, "2", "add", "3");
    act(() => result.current.press("equals"));
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => result.current.press("clear"));
    await act(async () => finish());

    expect(result.current.loading).toBe(false);
    expect(result.current.display).toMatchObject({ pending: "", value: "0" });
  });
});

describe("history", () => {
  it("records binary and unary calculations, newest first", async () => {
    const result = setup();

    await press(
      result,
      "2",
      "add",
      "3",
      "equals",
      "9",
      "sqrt",
      "1",
      "5",
      "percent",
    );

    expect(result.current.history).toEqual([
      { expr: "15%", result: 0.15 },
      { expr: "√9", result: 3 },
      { expr: "2 + 3", result: 5 },
    ]);
  });

  it("is capped at 8 entries and persisted", async () => {
    const result = setup();

    for (let i = 1; i <= 10; i++) {
      await press(result, ...digits(String(i)), "add", "1", "equals");
    }

    expect(result.current.history).toHaveLength(8);
    expect(result.current.history[0]).toEqual({ expr: "10 + 1", result: 11 });
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")).toHaveLength(
      8,
    );
  });

  it("reloads saved history on mount and clears it", () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ expr: "1 + 2", result: 3 }]),
    );
    const result = setup();
    expect(result.current.history).toEqual([{ expr: "1 + 2", result: 3 }]);

    act(() => result.current.clearHistory());

    expect(result.current.history).toEqual([]);
  });

  it("starts with empty history when stored data is corrupt", () => {
    localStorage.setItem(HISTORY_KEY, "{not json");

    expect(setup().current.history).toEqual([]);
  });

  it("reusing an entry loads its result as a fresh number", async () => {
    const result = setup();
    await press(result, "2", "add", "3", "equals");

    act(() => result.current.reuse({ expr: "2 + 3", result: 5 }));
    expect(result.current.display).toMatchObject({ pending: "", value: "5" });
    await press(result, "7");

    expect(result.current.display.value).toBe("7");
  });

  it("a reused result acts as the second operand when an operator is pending", async () => {
    const result = setup();
    await press(result, "1", "add");

    act(() => result.current.reuse({ expr: "2 + 3", result: 5 }));
    await press(result, "equals");

    expect(result.current.display.value).toBe("6");
  });
});

describe("reducer", () => {
  it("ignores = and unary keys itself, because the hook sends their requests", () => {
    const state = { ...initialState(), display: "9" };

    expect(reducer(state, { type: "KEY", id: "sqrt" })).toBe(state);
    expect(reducer(state, { type: "KEY", id: "equals" })).toBe(state);
  });

  it("requestForKey builds the request an operator needs", () => {
    const state: CalculatorState = {
      ...initialState(),
      display: "3",
      pending: { op: "add", left: 2 },
      operandReady: true,
    };

    expect(requestForKey(state, "multiply")).toEqual({
      kind: "binary",
      op: "add",
      a: 2,
      b: 3,
      next: "multiply",
    });
    expect(requestForKey(state, "7")).toBeNull();
    expect(
      requestForKey({ ...state, operandReady: false }, "equals"),
    ).toBeNull();
  });
});
