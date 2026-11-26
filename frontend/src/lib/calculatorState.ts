/** The calculator's state machine: pure functions, no React and no HTTP. */
import {
  OP_SYMBOLS,
  formatResult,
  isBinaryOp,
  type BinaryOp,
  type KeyId,
  type Operation,
} from "./calculator";
import { HISTORY_LIMIT, loadHistory, type HistoryEntry } from "./history";

const MAX_DIGITS = 15;

/** One backend call, and the key that asked for it. */
export interface Request {
  op: Operation;
  a: number;
  /** Absent for √ and %. */
  b?: number;
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
  pending: { op: BinaryOp; value: number; text: string } | null;
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

function typeChar(s: State, char: string): State {
  const base = s.fresh ? "" : s.text;
  if (char === "." && base.includes(".")) return s;
  const text =
    char === "."
      ? `${base || "0"}.`
      : base === "" || base === "0"
        ? char
        : base + char;
  if (text.replace(".", "").length > MAX_DIGITS) return s;
  return {
    ...s,
    text,
    value: Number(text),
    fresh: false,
    ready: true,
    error: null,
    done: null,
  };
}

function press(s: State, id: KeyId): State {
  if (id === "clear") return { ...BLANK, history: s.history };
  if (id === "clearEntry") {
    return { ...s, ...BLANK, pending: s.pending };
  }
  if (id === "decimal") return typeChar(s, ".");
  if (/^\d$/.test(id)) return typeChar(s, id);
  if (s.error !== null) return s;
  if (id === "backspace") {
    const text = s.text.slice(0, -1) || "0";
    return s.fresh ? s : { ...s, text, value: Number(text) };
  }
  // "=", √ and % only ever send a request (see requestFor), and so does an
  // operator with an operand ready; the rest is local.
  if (!isBinaryOp(id)) return s;
  if (s.pending) return { ...s, pending: { ...s.pending, op: id } };
  return {
    ...s,
    pending: { op: id, value: s.value, text: s.text },
    fresh: true,
    ready: false,
    done: null,
  };
}

/** The backend call a key needs, or null when it only changes local state. */
export function requestFor(s: State, id: KeyId): Request | null {
  if (s.error !== null) return null;
  if (id === "sqrt") {
    return { op: id, a: s.value, label: `√${s.text}`, next: id };
  }
  if (id === "percent") {
    return { op: id, a: s.value, label: `${s.text}%`, next: id };
  }
  if (!(isBinaryOp(id) || id === "equals") || !s.pending || !s.ready) {
    return null;
  }
  const { op, value, text } = s.pending;
  return {
    op,
    a: value,
    b: s.value,
    label: `${text} ${OP_SYMBOLS[op]} ${s.text}`,
    next: id,
  };
}

function applyResult(s: State, r: Request, result: number): State {
  const text = formatResult(result);
  const shown: State = {
    ...s,
    text,
    value: result,
    fresh: true,
    ready: true,
    error: null,
    done: null,
    history: [{ expr: r.label, result }, ...s.history].slice(0, HISTORY_LIMIT),
  };
  if (r.next === "equals") {
    return { ...shown, pending: null, ready: false, done: `${r.label} =` };
  }
  if (isBinaryOp(r.next)) {
    return {
      ...shown,
      pending: { op: r.next, value: result, text },
      ready: false,
    };
  }
  return shown;
}

export function reducer(s: State, action: Action): State {
  switch (action.type) {
    case "key":
      return press(s, action.id);
    case "succeeded":
      return applyResult(s, action.request, action.result);
    case "rejected":
      return {
        ...BLANK,
        history: s.history,
        error: action.message,
        fresh: true,
      };
    case "reuse":
      return {
        ...s,
        text: formatResult(action.result),
        value: action.result,
        fresh: true,
        ready: s.pending !== null,
        error: null,
        done: null,
      };
    case "clearHistory":
      return { ...s, history: [] };
  }
}

export interface Display {
  /** The small line above the value, e.g. "5 +"; empty when there is none. */
  pending: string;
  value: string;
  isError: boolean;
}

export const displayOf = (s: State): Display => ({
  pending: s.pending
    ? `${s.pending.text} ${OP_SYMBOLS[s.pending.op]}`
    : (s.done ?? ""),
  value: s.error ?? s.text,
  isError: s.error !== null,
});
