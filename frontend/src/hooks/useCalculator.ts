import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  ApiValidationError,
  ServerUnavailableError,
  calculateRemote,
} from "../api/calculate";
import {
  CalcError,
  evaluate,
  formatResult,
  liveError,
  preview,
  type KeyDef,
} from "../lib/calculator";
import {
  addEntry,
  loadHistory,
  saveHistory,
  type HistoryEntry,
} from "../lib/history";

export interface CalculatorState {
  expr: string;
  result: number | null;
  /** Error from pressing Calculate; cleared by the next edit. */
  submittedError: string | null;
  /** Last valid preview, kept while the user types an incomplete expression. */
  lastPreview: string | null;
  loading: boolean;
  serverErrorOpen: boolean;
  history: HistoryEntry[];
}

type Action =
  | { type: "EDIT"; expr: string }
  | { type: "CLEAR" }
  | { type: "CALC_INVALID"; message: string }
  | { type: "REQUEST_START" }
  | { type: "REQUEST_END" }
  | { type: "REQUEST_SUCCESS"; expr: string; result: number }
  | { type: "REQUEST_FAILED" }
  | { type: "DISMISS_SERVER_ERROR" }
  | { type: "REUSE"; entry: HistoryEntry }
  | { type: "CLEAR_HISTORY" };

export type DisplayTone = "primary" | "disabled";

export interface Display {
  label: "Result" | "Preview";
  value: string;
  tone: DisplayTone;
}

const isBlank = (s: string): boolean => s.trim() === "";

function edited(state: CalculatorState, expr: string): CalculatorState {
  return {
    ...state,
    expr,
    result: null,
    submittedError: null,
    lastPreview: isBlank(expr) ? null : (preview(expr) ?? state.lastPreview),
  };
}

export function reducer(
  state: CalculatorState,
  action: Action,
): CalculatorState {
  switch (action.type) {
    case "EDIT":
      return edited(state, action.expr);
    case "CLEAR":
      return {
        ...state,
        expr: "",
        result: null,
        submittedError: null,
        lastPreview: null,
      };
    case "CALC_INVALID":
      // The user's input is never touched on an error.
      return { ...state, submittedError: action.message, result: null };
    case "REQUEST_START":
      return { ...state, loading: true };
    case "REQUEST_END":
      return { ...state, loading: false };
    case "REQUEST_SUCCESS":
      return {
        ...state,
        history: addEntry(state.history, {
          expr: action.expr,
          result: action.result,
        }),
        // Only show the result if the user has not edited since submitting.
        result: state.expr === action.expr ? action.result : state.result,
        serverErrorOpen: false,
      };
    case "REQUEST_FAILED":
      return { ...state, serverErrorOpen: true };
    case "DISMISS_SERVER_ERROR":
      return { ...state, serverErrorOpen: false };
    case "REUSE":
      return edited(state, action.entry.expr);
    case "CLEAR_HISTORY":
      return { ...state, history: [] };
  }
}

function initialState(): CalculatorState {
  return {
    expr: "",
    result: null,
    submittedError: null,
    lastPreview: null,
    loading: false,
    serverErrorOpen: false,
    history: loadHistory(),
  };
}

/** The error shown on the field: a submitted one, else a live lexical one. */
export function fieldErrorOf(state: CalculatorState): string | null {
  return state.submittedError ?? liveError(state.expr)?.message ?? null;
}

/** What the result area shows: the first rule that matches. */
export function displayOf(state: CalculatorState): Display {
  if (state.result !== null) {
    return {
      label: "Result",
      value: formatResult(state.result),
      tone: "primary",
    };
  }
  if (state.submittedError !== null) {
    return { label: "Result", value: "—", tone: "disabled" };
  }
  if (isBlank(state.expr)) {
    return { label: "Result", value: "0", tone: "disabled" };
  }
  const value = preview(state.expr) ?? state.lastPreview;
  return value === null
    ? { label: "Result", value: "0", tone: "disabled" }
    : { label: "Preview", value, tone: "disabled" };
}

/**
 * The expression after pressing a key. After a result is showing, digits, ".",
 * "√" and "(" start a new expression while operators, "xʸ" and "%" continue
 * from the result.
 */
export function nextExpression(
  expr: string,
  key: KeyDef,
  result: number | null,
): string {
  if (key.kind === "clear") return "";
  if (key.id === "backspace") {
    const chars = Array.from(expr.trimEnd());
    chars.pop();
    return chars.join("").trimEnd();
  }

  const hasResult = result !== null;
  const startsFresh =
    hasResult &&
    (key.kind === "num" || key.id === "sqrt" || key.id === "lparen");
  const continuesFromResult =
    hasResult &&
    (key.kind === "op" || key.id === "pow" || key.id === "percent");

  let base = expr;
  if (startsFresh) {
    base = "";
  } else if (continuesFromResult) {
    // Exponent notation (1e+21) is not valid input, so wrap the expression.
    const text = String(result).replace(/^-/, "−");
    base = text.includes("e") ? `(${expr})` : text;
  }

  return `${base}${key.insert ?? ""}`.replace(/ {2,}/g, " ").trimStart();
}

const isAbort = (e: unknown): boolean =>
  e instanceof DOMException && e.name === "AbortError";

export function useCalculator() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const loadingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => saveHistory(state.history), [state.history]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const { expr } = state;

  const calculate = useCallback(async () => {
    if (loadingRef.current) return;
    try {
      evaluate(expr);
    } catch (e) {
      if (e instanceof CalcError) {
        dispatch({ type: "CALC_INVALID", message: e.message });
        return;
      }
      throw e;
    }

    loadingRef.current = true;
    dispatch({ type: "REQUEST_START" });
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await calculateRemote(expr, { signal: controller.signal });
      dispatch({ type: "REQUEST_SUCCESS", expr, result });
    } catch (e) {
      if (e instanceof ApiValidationError) {
        dispatch({ type: "CALC_INVALID", message: e.message });
      } else if (e instanceof ServerUnavailableError) {
        dispatch({ type: "REQUEST_FAILED" });
      } else if (!isAbort(e)) {
        throw e;
      }
    } finally {
      loadingRef.current = false;
      dispatch({ type: "REQUEST_END" });
    }
  }, [expr]);

  const setExpr = useCallback(
    (value: string) => dispatch({ type: "EDIT", expr: value }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const reuse = useCallback(
    (entry: HistoryEntry) => dispatch({ type: "REUSE", entry }),
    [],
  );
  const clearHistory = useCallback(
    () => dispatch({ type: "CLEAR_HISTORY" }),
    [],
  );
  const dismissServerError = useCallback(
    () => dispatch({ type: "DISMISS_SERVER_ERROR" }),
    [],
  );
  const retry = useCallback(() => {
    dispatch({ type: "DISMISS_SERVER_ERROR" });
    return calculate();
  }, [calculate]);

  const press = useCallback(
    (key: KeyDef) => {
      if (key.kind === "clear") clear();
      else if (key.kind === "equals") void calculate();
      else setExpr(nextExpression(expr, key, state.result));
    },
    [expr, state.result, calculate, clear, setExpr],
  );

  return {
    expr,
    setExpr,
    press,
    calculate,
    clear,
    reuse,
    clearHistory,
    retry,
    dismissServerError,
    loading: state.loading,
    fieldError: fieldErrorOf(state),
    display: displayOf(state),
    history: state.history,
    serverErrorOpen: state.serverErrorOpen,
  };
}
