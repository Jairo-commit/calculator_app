/** The calculator's state machine: pure functions, no React and no HTTP. */
import {
  OPERATION_SYMBOLS,
  formatResult,
  isBinaryOperation,
  type BinaryOperation,
  type KeyId,
  type Operation,
} from "./calculator";
import { HISTORY_LIMIT, loadHistory, type HistoryEntry } from "./history";

const MAX_DIGITS = 15;

/** One backend call, and the key that asked for it. */
export interface Request {
  operation: Operation;
  firstOperand: number;
  /** Absent for √ and %. */
  secondOperand?: number;
  /** The history text, e.g. "2 + 3" or "√9". */
  label: string;
  /** An operator chains from the result, "equals" finishes, √ and % stay put. */
  next: KeyId;
}

export interface State {
  /** What the display shows: typed as typed, a result already formatted. */
  text: string;
  value: number;
  /** True when the next digit starts a new number. */
  fresh: boolean;
  /** The operator waiting for its second operand, and the first one. */
  pending: { operation: BinaryOperation; value: number; text: string } | null;
  /** True once an operand is on screen since the operator was pressed. */
  ready: boolean;
  /** A 400 message; replaces the display until a digit, C or CE. */
  error: string | null;
  /** The finished equation after "=", e.g. "2 + 3 =". */
  done: string | null;
  history: HistoryEntry[];
}

export type Action =
  | { type: "key"; id: KeyId }
  | { type: "succeeded"; request: Request; result: number }
  | { type: "rejected"; message: string }
  | { type: "reuse"; result: number }
  | { type: "clearHistory" };

const BLANK = {
  text: "0",
  value: 0,
  fresh: false,
  pending: null,
  ready: false,
  error: null,
  done: null,
} as const;

export const initialState = (): State => ({
  ...BLANK,
  history: loadHistory(),
});

function typeChar(state: State, char: string): State {
  const base = state.fresh ? "" : state.text;
  if (char === "." && base.includes(".")) return state;
  const text =
    char === "."
      ? `${base || "0"}.`
      : base === "" || base === "0"
        ? char
        : base + char;
  if (text.replace(".", "").length > MAX_DIGITS) return state;
  return {
    ...state,
    text,
    value: Number(text),
    fresh: false,
    ready: true,
    error: null,
    done: null,
  };
}

function press(state: State, id: KeyId): State {
  if (id === "clear") return { ...BLANK, history: state.history };
  if (id === "clearEntry") {
    return { ...state, ...BLANK, pending: state.pending };
  }
  if (/^\d$/.test(id)) return typeChar(state, id);
  if (state.error !== null) return state;
  if (id === "decimal") return typeChar(state, ".");
  if (id === "backspace") {
    const text = state.text.slice(0, -1) || "0";
    return state.fresh ? state : { ...state, text, value: Number(text) };
  }
  // "=", √ and % only ever send a request (see requestFor), and so does an
  // operator with an operand ready; the rest is local.
  if (!isBinaryOperation(id)) return state;
  if (state.pending)
    return { ...state, pending: { ...state.pending, operation: id } };
  return {
    ...state,
    pending: { operation: id, value: state.value, text: state.text },
    fresh: true,
    ready: false,
    done: null,
  };
}

/** The backend call a key needs, or null when it only changes local state. */
export function requestFor(state: State, id: KeyId): Request | null {
  if (state.error !== null) return null;
  if (id === "sqrt") {
    return {
      operation: id,
      firstOperand: state.value,
      label: `√${state.text}`,
      next: id,
    };
  }
  if (id === "percent") {
    return {
      operation: id,
      firstOperand: state.value,
      label: `${state.text}%`,
      next: id,
    };
  }
  if (
    !(isBinaryOperation(id) || id === "equals") ||
    !state.pending ||
    !state.ready
  ) {
    return null;
  }
  const { operation, value, text } = state.pending;
  return {
    operation,
    firstOperand: value,
    secondOperand: state.value,
    label: `${text} ${OPERATION_SYMBOLS[operation]} ${state.text}`,
    next: id,
  };
}

function applyResult(state: State, request: Request, result: number): State {
  const text = formatResult(result);
  const shown: State = {
    ...state,
    text,
    value: result,
    fresh: true,
    ready: true,
    error: null,
    done: null,
    history: [{ expr: request.label, result }, ...state.history].slice(
      0,
      HISTORY_LIMIT,
    ),
  };
  if (request.next === "equals") {
    return {
      ...shown,
      pending: null,
      ready: false,
      done: `${request.label} =`,
    };
  }
  if (isBinaryOperation(request.next)) {
    return {
      ...shown,
      pending: { operation: request.next, value: result, text },
      ready: false,
    };
  }
  return shown;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "key":
      return press(state, action.id);
    case "succeeded":
      return applyResult(state, action.request, action.result);
    case "rejected":
      return {
        ...BLANK,
        history: state.history,
        error: action.message,
        fresh: true,
      };
    case "reuse":
      return {
        ...state,
        text: formatResult(action.result),
        value: action.result,
        fresh: true,
        ready: state.pending !== null,
        error: null,
        done: null,
      };
    case "clearHistory":
      return { ...state, history: [] };
  }
}

export interface Display {
  /** The small line above the value, e.g. "5 +"; empty when there is none. */
  pending: string;
  value: string;
  isError: boolean;
}

export const displayOf = (state: State): Display => ({
  pending: state.pending
    ? `${state.pending.text} ${OPERATION_SYMBOLS[state.pending.operation]}`
    : (state.done ?? ""),
  value: state.error ?? state.text,
  isError: state.error !== null,
});
