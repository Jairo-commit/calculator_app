import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERRORS, KEYPAD, type KeyDef } from "../lib/calculator";
import { HISTORY_KEY } from "../lib/history";
import { nextExpression, useCalculator } from "./useCalculator";

const key = (id: string): KeyDef => {
  const found = KEYPAD.find((k) => k.id === id);
  if (!found) throw new Error(`no key ${id}`);
  return found;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

async function submit(
  result: { current: ReturnType<typeof useCalculator> },
  expr: string,
) {
  act(() => result.current.setExpr(expr));
  await act(async () => {
    await result.current.calculate();
  });
}

describe("nextExpression", () => {
  it("appends digits bare and operators spaced", () => {
    expect(nextExpression("12", key("plus"), null)).toBe("12 + ");
    expect(nextExpression("12 + ", key("3"), null)).toBe("12 + 3");
  });

  it("collapses double spaces and trims the start", () => {
    expect(nextExpression("5 × ", key("minus"), null)).toBe("5 × − ");
    expect(nextExpression("", key("plus"), null)).toBe("+ ");
  });

  it("clears on C", () => {
    expect(nextExpression("12 + 3", key("clear"), null)).toBe("");
  });

  it("backspace drops the last non-space character", () => {
    expect(nextExpression("12 + ", key("backspace"), null)).toBe("12");
    expect(nextExpression("√", key("backspace"), null)).toBe("");
    expect(nextExpression("", key("backspace"), null)).toBe("");
  });

  it.each(["7", "decimal", "sqrt", "lparen"])(
    "%s after a result starts a new expression",
    (id) => {
      expect(nextExpression("2 + 3", key(id), 5)).toBe(key(id).insert);
    },
  );

  it.each([
    ["multiply", "5 × "],
    ["pow", "5 ^ "],
    ["percent", "5%"],
    ["plus", "5 + "],
  ])("%s after a result continues from the result", (id, expected) => {
    expect(nextExpression("2 + 3", key(id), 5)).toBe(expected);
  });

  it("uses a true minus sign for negative results", () => {
    expect(nextExpression("−2 ^ 2", key("plus"), -4)).toBe("−4 + ");
  });

  it("wraps a negative result in parentheses for xʸ only", () => {
    expect(nextExpression("−2", key("pow"), -2)).toBe("(−2) ^ ");
    expect(nextExpression("−2", key("plus"), -2)).toBe("−2 + ");
  });

  it("wraps the expression when the result needs exponent notation", () => {
    expect(nextExpression("10 ^ 25", key("plus"), 1e25)).toBe("(10 ^ 25) + ");
  });
});

describe("useCalculator", () => {
  it("rejects an invalid expression locally without a request", async () => {
    const { result } = renderHook(() => useCalculator());

    await submit(result, "12 + × 4");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fieldError).toBe("Two operators in a row");
    expect(result.current.display).toMatchObject({
      label: "Result",
      value: "—",
    });
    expect(result.current.expr).toBe("12 + × 4");
  });

  it("rejects a division by zero locally", async () => {
    const { result } = renderHook(() => useCalculator());

    await submit(result, "48 ÷ 0");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fieldError).toBe(ERRORS.DIV_ZERO);
  });

  it("shows only live errors while typing and the full error after calculate", async () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.setExpr("12 +"));
    expect(result.current.fieldError).toBeNull();

    act(() => result.current.setExpr("12 + a"));
    expect(result.current.fieldError).toBe(ERRORS.INVALID_CHAR);

    await submit(result, "12 +");
    expect(result.current.fieldError).toBe(ERRORS.END_OPERATOR);

    act(() => result.current.setExpr("12 + "));
    expect(result.current.fieldError).toBeNull();
  });

  it("previews valid expressions and keeps the last preview while incomplete", () => {
    const { result } = renderHook(() => useCalculator());
    expect(result.current.display).toEqual({
      label: "Result",
      value: "0",
      tone: "disabled",
    });

    act(() => result.current.setExpr("1250 × 15%"));
    expect(result.current.display).toEqual({
      label: "Preview",
      value: "187.5",
      tone: "disabled",
    });

    act(() => result.current.setExpr("1250 × 15% + "));
    expect(result.current.display).toMatchObject({
      label: "Preview",
      value: "187.5",
    });

    act(() => result.current.setExpr(""));
    expect(result.current.display.value).toBe("0");
  });

  it("shows no stale preview when the text has a live error", () => {
    const { result } = renderHook(() => useCalculator());
    act(() => result.current.setExpr("1250 × 15%"));
    expect(result.current.display.value).toBe("187.5");

    act(() => result.current.setExpr("1.2.3"));
    expect(result.current.display).toEqual({
      label: "Result",
      value: "0",
      tone: "disabled",
    });

    // Fixing the text must not resurrect the discarded preview either.
    act(() => result.current.setExpr("1 + "));
    expect(result.current.display.value).toBe("0");
  });

  it("continues xʸ from a negative result as (−2) ^ 2 = 4", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { result: -2 }))
      .mockResolvedValueOnce(json(200, { result: 4 }));
    const { result } = renderHook(() => useCalculator());

    await submit(result, "0 − 2");
    act(() => result.current.press(key("pow")));
    expect(result.current.expr).toBe("(−2) ^ ");
    act(() => result.current.press(key("2")));
    act(() => result.current.press(key("equals")));
    await waitFor(() => expect(result.current.display.value).toBe("4"));
  });

  it("continues + from a positive result", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { result: 5 }));
    const { result } = renderHook(() => useCalculator());

    await submit(result, "2 + 3");
    act(() => result.current.press(key("plus")));

    expect(result.current.expr).toBe("5 + ");
  });

  it("ignores a server 400 for text edited during the request", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    const { result } = renderHook(() => useCalculator());
    act(() => result.current.setExpr("1 + 1"));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.calculate();
    });
    act(() => result.current.setExpr("1 + 12"));
    await act(async () => {
      finish(json(400, { error: "Can’t divide by zero" }));
      await pending;
    });

    expect(result.current.fieldError).toBeNull();
  });

  it("closes the server error as soon as a new request starts", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const { result } = renderHook(() => useCalculator());
    await submit(result, "2 + 2");
    expect(result.current.serverErrorOpen).toBe(true);

    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.calculate();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.serverErrorOpen).toBe(false);

    await act(async () => {
      finish(json(200, { result: 4 }));
      await pending;
    });
  });

  it("shows the result and records history on success", async () => {
    fetchMock.mockResolvedValue(json(200, { result: 60 }));
    const { result } = renderHook(() => useCalculator());

    await submit(result, "(12 + 8) × 3");

    expect(result.current.display).toEqual({
      label: "Result",
      value: "60",
      tone: "primary",
    });
    expect(result.current.history).toEqual([
      { expr: "(12 + 8) × 3", result: 60 },
    ]);
    expect(result.current.loading).toBe(false);
  });

  it("keeps 8 entries newest first, saves them and restores them on remount", async () => {
    const { result, unmount } = renderHook(() => useCalculator());
    for (let n = 1; n <= 9; n++) {
      fetchMock.mockResolvedValueOnce(json(200, { result: n }));
      await submit(result, `${n}`);
    }

    expect(result.current.history.map((h) => h.expr)).toEqual([
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
    ]);
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")).toHaveLength(
      8,
    );
    unmount();

    const remounted = renderHook(() => useCalculator());
    expect(remounted.result.current.history[0]).toEqual({
      expr: "9",
      result: 9,
    });
    expect(remounted.result.current.history).toHaveLength(8);
  });

  it("starts with empty history when stored data is corrupt", () => {
    localStorage.setItem(HISTORY_KEY, "{not json");

    const { result } = renderHook(() => useCalculator());

    expect(result.current.history).toEqual([]);
  });

  it("shows a server 400 on the field", async () => {
    fetchMock.mockResolvedValue(json(400, { error: "Can’t divide by zero" }));
    const { result } = renderHook(() => useCalculator());

    await submit(result, "1 + 1");

    expect(result.current.fieldError).toBe("Can’t divide by zero");
    expect(result.current.expr).toBe("1 + 1");
  });

  it("opens the server error, keeps the input, and retry succeeds", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const { result } = renderHook(() => useCalculator());

    await submit(result, "2 + 2");

    expect(result.current.serverErrorOpen).toBe(true);
    expect(result.current.expr).toBe("2 + 2");
    expect(result.current.history).toEqual([]);

    fetchMock.mockResolvedValueOnce(json(200, { result: 4 }));
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.serverErrorOpen).toBe(false);
    expect(result.current.display.value).toBe("4");
  });

  it("sends one request when calculate is called twice while loading", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    const { result } = renderHook(() => useCalculator());
    act(() => result.current.setExpr("1 + 1"));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.calculate();
      void result.current.calculate();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      finish(json(200, { result: 2 }));
      await first;
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  it("records history but shows no result when edited during the request", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    const { result } = renderHook(() => useCalculator());
    act(() => result.current.setExpr("1 + 1"));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.calculate();
    });
    act(() => result.current.setExpr("1 + 12"));
    await act(async () => {
      finish(json(200, { result: 2 }));
      await pending;
    });

    expect(result.current.history).toEqual([{ expr: "1 + 1", result: 2 }]);
    expect(result.current.display).toMatchObject({
      label: "Preview",
      value: "13",
    });
  });

  it("continues from the result: 2 + 3 = 5, then × 2 = gives 10", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { result: 5 }))
      .mockResolvedValueOnce(json(200, { result: 10 }));
    const { result } = renderHook(() => useCalculator());

    await submit(result, "2 + 3");
    act(() => result.current.press(key("multiply")));
    expect(result.current.expr).toBe("5 × ");
    act(() => result.current.press(key("2")));
    act(() => result.current.press(key("equals")));
    await waitFor(() => expect(result.current.display.value).toBe("10"));

    expect(result.current.expr).toBe("5 × 2");
  });

  it("clears expression, result and error", async () => {
    const { result } = renderHook(() => useCalculator());
    await submit(result, "5 +");

    act(() => result.current.clear());

    expect(result.current.expr).toBe("");
    expect(result.current.fieldError).toBeNull();
    expect(result.current.display.value).toBe("0");
  });

  it("reuses a history entry and clears the history", async () => {
    fetchMock.mockResolvedValue(json(200, { result: 3 }));
    const { result } = renderHook(() => useCalculator());
    await submit(result, "1 + 2");

    act(() => result.current.clear());
    act(() => result.current.reuse(result.current.history[0]));
    expect(result.current.expr).toBe("1 + 2");
    expect(result.current.display).toMatchObject({
      label: "Preview",
      value: "3",
    });

    act(() => result.current.clearHistory());
    expect(result.current.history).toEqual([]);
  });

  it("aborts the request in flight on unmount", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise(() => {});
    });
    const { result, unmount } = renderHook(() => useCalculator());
    act(() => result.current.setExpr("1 + 1"));
    act(() => {
      void result.current.calculate();
    });

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
