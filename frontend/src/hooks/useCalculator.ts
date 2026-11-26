import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  ApiValidationError,
  ServerUnavailableError,
  callOperation,
  type Operands,
} from "../api/calculate";
import {
  OP_SYMBOLS,
  formatResult,
  isBinaryOp,
  isDigitId,
  isUnaryOp,
  type BinaryOp,
  type DigitId,
  type KeyId,
  type UnaryOp,
} from "../lib/calculator";
import {
  addEntry,
  loadHistory,
  saveHistory,
  type HistoryEntry,
} from "../lib/history";

/** Most digits a typed number can have. */
export const MAX_DIGITS = 15;

/** One call to the backend, with what to do with its answer. */
export type CalcRequest =
  | {
      kind: "binary";
      op: BinaryOp;
      a: number;
      b: number;
      /** The key that triggered it: an operator to chain, or "=" to finish. */
      next: BinaryOp | "equals";
    }
  | { kind: "unary"; op: UnaryOp; a: number };

/** An operator waiting for its second operand. */
interface Pending {
  op: BinaryOp;
  left: number;
}

export interface CalculatorState {
  /** The number on screen, as plain text that Number() can read. */
  display: string;
  pending: Pending | null;
  /** "typing": digits append. "result": the next digit starts a new number. */
  entry: "typing" | "result";
  /** True once a second operand is on screen since the operator was pressed. */
  operandReady: boolean;
  /** Message from the server for input the user can fix; replaces the display. */
  error: string | null;
  /** The finished equation shown after "=", e.g. "2 + 3 =". */
  finished: string | null;
  loading: boolean;
  serverErrorOpen: boolean;
  /** The request that failed on the server side, for Retry. */
  lastRequest: CalcRequest | null;
  history: HistoryEntry[];
}

export type Action =
  | { type: "KEY"; id: KeyId }
  | { type: "REQUEST_START" }
  | { type: "REQUEST_END" }
  | { type: "REQUEST_SUCCEEDED"; request: CalcRequest; result: number }
  | { type: "REQUEST_REJECTED"; message: string }
  | { type: "REQUEST_FAILED"; request: CalcRequest }
  | { type: "DISMISS_SERVER_ERROR" }
  | { type: "REUSE"; entry: HistoryEntry }
  | { type: "CLEAR_HISTORY" };

export interface Display {
  /** The small line above the value, e.g. "5 +"; empty when there is none. */
  pending: string;
  value: string;
  isError: boolean;
}

const INITIAL_NUMBER = {
  display: "0",
  pending: null,
  entry: "typing",
  operandReady: false,
  error: null,
  finished: null,
} as const satisfies Partial<CalculatorState>;

export function initialState(): CalculatorState {
  return {
    ...INITIAL_NUMBER,
    loading: false,
    serverErrorOpen: false,
    lastRequest: null,
    history: loadHistory(),
  };
}

const digitCount = (text: string): number => text.replace(".", "").length;

function typeCharacter(
  state: CalculatorState,
  char: DigitId | ".",
): CalculatorState {
  const startsFresh = state.entry === "result" || state.error !== null;
  const base = startsFresh ? "" : state.display;
  let next: string;
  if (char === ".") {
    if (base.includes(".")) return state;
    next = base === "" ? "0." : `${base}.`;
  } else {
    next = base === "" || base === "0" ? char : `${base}${char}`;
  }
  if (digitCount(next) > MAX_DIGITS) return state;
  return {
    ...state,
    display: next,
    entry: "typing",
    operandReady: true,
    error: null,
    finished: null,
  };
}

function pressOperator(state: CalculatorState, op: BinaryOp): CalculatorState {
  if (state.pending) {
    // Two signs in a row swap the pending operation; with an operand ready the
    // hook sends a request instead (see requestForKey).
    return state.operandReady
      ? state
      : { ...state, pending: { ...state.pending, op } };
  }
  return {
    ...state,
    pending: { op, left: Number(state.display) },
    entry: "result",
    operandReady: false,
    finished: null,
  };
}

function pressKey(state: CalculatorState, id: KeyId): CalculatorState {
  if (id === "clear") {
    return {
      ...state,
      ...INITIAL_NUMBER,
      loading: false,
      serverErrorOpen: false,
      lastRequest: null,
    };
  }
  if (state.loading) return state;

  if (id === "clearEntry") {
    return {
      ...state,
      display: "0",
      entry: "typing",
      operandReady: false,
      error: null,
      finished: null,
    };
  }
  if (id === "decimal") return typeCharacter(state, ".");
  if (isDigitId(id)) return typeCharacter(state, id);

  // After a server-side rejection only a digit, C or CE work.
  if (state.error !== null) return state;

  if (id === "backspace") {
    if (state.entry !== "typing") return state;
    return { ...state, display: state.display.slice(0, -1) || "0" };
  }
  if (isBinaryOp(id)) return pressOperator(state, id);
  // "=", "√" and "%" only ever send a request; see requestForKey.
  return state;
}

/** The request a key press needs, or null when it only changes local state. */
export function requestForKey(
  state: CalculatorState,
  id: KeyId,
): CalcRequest | null {
  if (state.loading || state.error !== null) return null;
  const current = Number(state.display);
  if (isUnaryOp(id)) return { kind: "unary", op: id, a: current };

  const isChain = isBinaryOp(id) || id === "equals";
  if (!isChain || !state.pending || !state.operandReady) return null;
  return {
    kind: "binary",
    op: state.pending.op,
    a: state.pending.left,
    b: current,
    next: id,
  };
}

export function operandsOf(request: CalcRequest): Operands {
  return request.kind === "binary"
    ? { a: request.a, b: request.b }
    : { a: request.a };
}

function historyEntryFor(request: CalcRequest, result: number): HistoryEntry {
  if (request.kind === "unary") {
    const a = formatResult(request.a);
    return {
      expr: request.op === "sqrt" ? `√${a}` : `${a}%`,
      result,
    };
  }
  const { a, b, op } = request;
  return {
    expr: `${formatResult(a)} ${OP_SYMBOLS[op]} ${formatResult(b)}`,
    result,
  };
}

function applyResult(
  state: CalculatorState,
  request: CalcRequest,
  result: number,
): CalculatorState {
  const shown = {
    ...state,
    display: String(result),
    entry: "result" as const,
    error: null,
    finished: null,
    lastRequest: null,
    serverErrorOpen: false,
    history: addEntry(state.history, historyEntryFor(request, result)),
  };
  if (request.kind === "unary") return { ...shown, operandReady: true };

  const { a, b, op, next } = request;
  if (next === "equals") {
    return {
      ...shown,
      pending: null,
      operandReady: false,
      finished: `${formatResult(a)} ${OP_SYMBOLS[op]} ${formatResult(b)} =`,
    };
  }
  return {
    ...shown,
    pending: { op: next, left: result },
    operandReady: false,
  };
}

export function reducer(
  state: CalculatorState,
  action: Action,
): CalculatorState {
  switch (action.type) {
    case "KEY":
      return pressKey(state, action.id);
    case "REQUEST_START":
      return { ...state, loading: true, serverErrorOpen: false };
    case "REQUEST_END":
      return { ...state, loading: false };
    case "REQUEST_SUCCEEDED":
      return applyResult(state, action.request, action.result);
    case "REQUEST_REJECTED":
      return {
        ...state,
        error: action.message,
        pending: null,
        entry: "result",
        operandReady: false,
        finished: null,
        lastRequest: null,
        serverErrorOpen: false,
      };
    case "REQUEST_FAILED":
      return { ...state, serverErrorOpen: true, lastRequest: action.request };
    case "DISMISS_SERVER_ERROR":
      return { ...state, serverErrorOpen: false };
    case "REUSE":
      if (state.loading) return state;
      return {
        ...state,
        display: String(action.entry.result),
        entry: "result",
        operandReady: state.pending !== null,
        error: null,
        finished: null,
      };
    case "CLEAR_HISTORY":
      return { ...state, history: [] };
  }
}

/** What the screen shows for a state. */
export function displayOf(state: CalculatorState): Display {
  const pending = state.pending
    ? `${formatResult(state.pending.left)} ${OP_SYMBOLS[state.pending.op]}`
    : (state.finished ?? "");
  if (state.error !== null) {
    return { pending, value: state.error, isError: true };
  }
  const value =
    state.entry === "result"
      ? formatResult(Number(state.display))
      : state.display;
  return { pending, value, isError: false };
}

const isAbort = (e: unknown): boolean =>
  e instanceof DOMException && e.name === "AbortError";

export function useCalculator() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const loadingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => saveHistory(state.history), [state.history]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const send = useCallback(async (request: CalcRequest) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    dispatch({ type: "REQUEST_START" });
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await callOperation(request.op, operandsOf(request), {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        dispatch({ type: "REQUEST_SUCCEEDED", request, result });
      }
    } catch (e) {
      if (e instanceof ApiValidationError) {
        dispatch({ type: "REQUEST_REJECTED", message: e.message });
      } else if (e instanceof ServerUnavailableError) {
        dispatch({ type: "REQUEST_FAILED", request });
      } else if (!isAbort(e)) {
        throw e;
      }
    } finally {
      // After C the request is abandoned and a newer one may be in flight.
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        loadingRef.current = false;
        dispatch({ type: "REQUEST_END" });
      }
    }
  }, []);

  const press = useCallback(
    (id: KeyId) => {
      if (id === "clear") {
        controllerRef.current?.abort();
        controllerRef.current = null;
        loadingRef.current = false;
      }
      const request = requestForKey(state, id);
      if (request) void send(request);
      else dispatch({ type: "KEY", id });
    },
    [state, send],
  );

  const retry = useCallback(() => {
    dispatch({ type: "DISMISS_SERVER_ERROR" });
    if (state.lastRequest) void send(state.lastRequest);
  }, [state.lastRequest, send]);

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

  return {
    press,
    retry,
    reuse,
    clearHistory,
    dismissServerError,
    loading: state.loading,
    display: displayOf(state),
    history: state.history,
    serverErrorOpen: state.serverErrorOpen,
  };
}
