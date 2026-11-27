import {
  OPERATION_SYMBOLS,
  formatResult,
  isBinaryOperation,
  type BinaryOperation,
  type KeyId,
  type OperationCall,
} from "./calculator";
import { HISTORY_LIMIT, loadHistory, type HistoryEntry } from "./history";

const MAX_DIGITS = 15;

export interface OperationRequest {
  call: OperationCall;
  label: string;
  triggerKey: KeyId;
}

export interface State {
  text: string;
  value: number;
  startsNewNumber: boolean;
  pending: { operation: BinaryOperation; value: number; text: string } | null;
  hasSecondOperand: boolean;
  error: string | null;
  finishedEquation: string | null;
  history: HistoryEntry[];
}

export type Action =
  | { type: "key"; id: KeyId }
  | { type: "succeeded"; request: OperationRequest; result: number }
  | { type: "rejected"; message: string }
  | { type: "reuse"; result: number }
  | { type: "clearHistory" };

const BLANK = {
  text: "0",
  value: 0,
  startsNewNumber: false,
  pending: null,
  hasSecondOperand: false,
  error: null,
  finishedEquation: null,
} as const;

export const initialState = (): State => ({
  ...BLANK,
  history: loadHistory(),
});

function typeChar(state: State, char: string): State {
  const base = state.startsNewNumber ? "" : state.text;
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
    startsNewNumber: false,
    hasSecondOperand: true,
    error: null,
    finishedEquation: null,
  };
}

function press(state: State, id: KeyId): State {
  if (id === "clear") return { ...BLANK, history: state.history };
  if (/^\d$/.test(id)) return typeChar(state, id);
  if (state.error !== null) return state;
  if (id === "decimal") return typeChar(state, ".");
  if (id === "backspace") {
    const text = state.text.slice(0, -1) || "0";
    return state.startsNewNumber
      ? state
      : { ...state, text, value: Number(text) };
  }
  if (!isBinaryOperation(id)) return state;
  if (state.pending)
    return { ...state, pending: { ...state.pending, operation: id } };
  return {
    ...state,
    pending: { operation: id, value: state.value, text: state.text },
    startsNewNumber: true,
    hasSecondOperand: false,
    finishedEquation: null,
  };
}

export function requestFor(state: State, id: KeyId): OperationRequest | null {
  if (state.error !== null) return null;
  if (id === "sqrt") {
    return {
      call: { operation: id, firstOperand: state.value },
      label: `√${state.text}`,
      triggerKey: id,
    };
  }
  if (id === "percent") {
    return {
      call: { operation: id, firstOperand: state.value },
      label: `${state.text}%`,
      triggerKey: id,
    };
  }
  if (
    !(isBinaryOperation(id) || id === "equals") ||
    !state.pending ||
    !state.hasSecondOperand
  ) {
    return null;
  }
  const { operation, value, text } = state.pending;
  return {
    call: { operation, firstOperand: value, secondOperand: state.value },
    label: `${text} ${OPERATION_SYMBOLS[operation]} ${state.text}`,
    triggerKey: id,
  };
}

function applyResult(
  state: State,
  request: OperationRequest,
  result: number,
): State {
  const text = formatResult(result);
  const shown: State = {
    ...state,
    text,
    value: result,
    startsNewNumber: true,
    hasSecondOperand: true,
    error: null,
    finishedEquation: null,
    history: [{ expr: request.label, result }, ...state.history].slice(
      0,
      HISTORY_LIMIT,
    ),
  };
  if (request.triggerKey === "equals") {
    return {
      ...shown,
      pending: null,
      hasSecondOperand: false,
      finishedEquation: `${request.label} =`,
    };
  }
  if (isBinaryOperation(request.triggerKey)) {
    return {
      ...shown,
      pending: { operation: request.triggerKey, value: result, text },
      hasSecondOperand: false,
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
        startsNewNumber: true,
      };
    case "reuse":
      return {
        ...state,
        text: formatResult(action.result),
        value: action.result,
        startsNewNumber: true,
        hasSecondOperand: state.pending !== null,
        error: null,
        finishedEquation: null,
      };
    case "clearHistory":
      return { ...state, history: [] };
  }
}

export interface Display {
  pending: string;
  value: string;
  isError: boolean;
}

export const displayOf = (state: State): Display => ({
  pending: state.pending
    ? `${state.pending.text} ${OPERATION_SYMBOLS[state.pending.operation]}`
    : (state.finishedEquation ?? ""),
  value: state.error ?? state.text,
  isError: state.error !== null,
});
