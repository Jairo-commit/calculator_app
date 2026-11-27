import type {
  CalculatorState,
  PendingOperation,
} from "../models/calculatorState";
import type { Display } from "../models/display";
import type { KeyId } from "../models/key";
import type { OperationRequest } from "../models/operationRequest";
import {
  OPERATION_SYMBOLS,
  formatResult,
  isBinaryOperation,
} from "./operations";

const MAX_DIGITS = 15;
const MAX_DECIMALS = 10;

type CalculatorAction =
  | { type: "key"; id: KeyId }
  | { type: "succeeded"; request: OperationRequest; result: number }
  | { type: "rejected"; message: string };

export const initialState: CalculatorState = {
  text: "0",
  value: 0,
  startsNewNumber: false,
  pending: null,
  hasSecondOperand: false,
  error: null,
  finishedEquation: null,
};

function typeCharacter(
  state: CalculatorState,
  character: string,
): CalculatorState {
  const typedSoFar = state.startsNewNumber ? "" : state.text;
  if (character === "." && typedSoFar.includes(".")) return state;
  const nextText =
    character === "."
      ? `${typedSoFar || "0"}.`
      : typedSoFar === "" || typedSoFar === "0"
        ? character
        : typedSoFar + character;
  const decimalDigits = nextText.split(".")[1] ?? "";
  if (nextText.replace(".", "").length > MAX_DIGITS) return state;
  if (decimalDigits.length > MAX_DECIMALS) return state;
  return {
    ...state,
    text: nextText,
    value: Number(nextText),
    startsNewNumber: false,
    hasSecondOperand: true,
    error: null,
    finishedEquation: null,
  };
}

function pressLocalKey(state: CalculatorState, keyId: KeyId): CalculatorState {
  if (keyId === "clear") return initialState;
  if (/^\d$/.test(keyId)) return typeCharacter(state, keyId);
  if (state.error !== null) return state;
  if (keyId === "decimal") return typeCharacter(state, ".");
  if (keyId === "backspace") {
    const shortenedText = state.text.slice(0, -1) || "0";
    return state.startsNewNumber
      ? state
      : { ...state, text: shortenedText, value: Number(shortenedText) };
  }
  if (!isBinaryOperation(keyId)) return state;
  if (state.pending)
    return { ...state, pending: { ...state.pending, operation: keyId } };
  return {
    ...state,
    pending: { operation: keyId, value: state.value, text: state.text },
    startsNewNumber: true,
    hasSecondOperand: false,
    finishedEquation: null,
  };
}

export function requestFor(
  state: CalculatorState,
  keyId: KeyId,
): OperationRequest | null {
  if (state.error !== null) return null;
  if (keyId === "sqrt" || keyId === "percent") {
    return {
      operationCall: { operation: keyId, firstOperand: state.value },
      triggerKey: keyId,
    };
  }
  if (
    !(isBinaryOperation(keyId) || keyId === "equals") ||
    !state.pending ||
    !state.hasSecondOperand
  ) {
    return null;
  }
  const { operation: pendingOperation, value: firstOperand } = state.pending;
  return {
    operationCall: {
      operation: pendingOperation,
      firstOperand,
      secondOperand: state.value,
    },
    triggerKey: keyId,
  };
}

const pendingOperationLine = ({ text, operation }: PendingOperation) =>
  `${text} ${OPERATION_SYMBOLS[operation]}`;

function applyResult(
  state: CalculatorState,
  request: OperationRequest,
  result: number,
): CalculatorState {
  const resultText = formatResult(result);
  const stateShowingResult: CalculatorState = {
    ...state,
    text: resultText,
    value: result,
    startsNewNumber: true,
    hasSecondOperand: true,
    error: null,
    finishedEquation: null,
  };
  if (request.triggerKey === "equals") {
    if (!state.pending) {
      throw new Error("Equals answered without a pending operation");
    }
    return {
      ...stateShowingResult,
      pending: null,
      hasSecondOperand: false,
      finishedEquation: `${pendingOperationLine(state.pending)} ${state.text} =`,
    };
  }
  if (isBinaryOperation(request.triggerKey)) {
    return {
      ...stateShowingResult,
      pending: {
        operation: request.triggerKey,
        value: result,
        text: resultText,
      },
      hasSecondOperand: false,
    };
  }
  return stateShowingResult;
}

export function reducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    case "key":
      return pressLocalKey(state, action.id);
    case "succeeded":
      return applyResult(state, action.request, action.result);
    case "rejected":
      return {
        ...initialState,
        error: action.message,
        startsNewNumber: true,
      };
  }
}

export const displayOf = (state: CalculatorState): Display => ({
  pending: state.pending
    ? pendingOperationLine(state.pending)
    : (state.finishedEquation ?? ""),
  value: state.error ?? state.text,
  isError: state.error !== null,
});
