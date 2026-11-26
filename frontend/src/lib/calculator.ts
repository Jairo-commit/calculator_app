/** Calculator vocabulary: operations, keypad and number formatting. No math lives here. */

export type BinaryOp = "add" | "subtract" | "multiply" | "divide" | "power";
export type UnaryOp = "sqrt" | "percent";
/** An operation is also its endpoint name: POST /api/<operation>. */
export type Operation = BinaryOp | UnaryOp;

export type DigitId = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

const BINARY_OPS: readonly BinaryOp[] = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "power",
];
const UNARY_OPS: readonly UnaryOp[] = ["sqrt", "percent"];

export const isBinaryOp = (id: string): id is BinaryOp =>
  (BINARY_OPS as readonly string[]).includes(id);

export const isUnaryOp = (id: string): id is UnaryOp =>
  (UNARY_OPS as readonly string[]).includes(id);

export const isDigitId = (id: string): id is DigitId => /^[0-9]$/.test(id);

/** The sign shown for each binary operation. */
export const OP_SYMBOLS: Record<BinaryOp, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  power: "^",
};

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 10,
});

/** Formats with en-US grouping, up to 10 decimals, and a true minus sign. */
export function formatResult(n: number): string {
  return numberFormat.format(n).replace(/^-/, "−");
}

// ---------------------------------------------------------------------------
// Keypad
// ---------------------------------------------------------------------------

export type KeyId =
  | DigitId
  | "decimal"
  | Operation
  | "equals"
  | "clear"
  | "clearEntry"
  | "backspace";

export type KeyKind = "num" | "op" | "fn" | "util" | "clear" | "equals";

export interface KeyDef {
  id: KeyId;
  label: string;
  kind: KeyKind;
  ariaLabel: string;
  /** Columns the key spans; absent means 1. */
  span?: 2;
  /** Rows the key spans; absent means 1. */
  rowSpan?: 2;
}

const digit = (d: DigitId): KeyDef => ({
  id: d,
  label: d,
  kind: "num",
  ariaLabel: d,
});

/** The 22 keys in grid order (4 columns); "=" spans two rows. */
export const KEYPAD: readonly KeyDef[] = [
  { id: "clear", label: "C", kind: "clear", ariaLabel: "Clear" },
  { id: "clearEntry", label: "CE", kind: "util", ariaLabel: "Clear entry" },
  { id: "backspace", label: "⌫", kind: "util", ariaLabel: "Backspace" },
  { id: "divide", label: "÷", kind: "op", ariaLabel: "Divide" },
  { id: "sqrt", label: "√", kind: "fn", ariaLabel: "Square root" },
  { id: "power", label: "xʸ", kind: "fn", ariaLabel: "Power" },
  { id: "percent", label: "%", kind: "fn", ariaLabel: "Percent" },
  { id: "multiply", label: "×", kind: "op", ariaLabel: "Multiply" },
  digit("7"),
  digit("8"),
  digit("9"),
  { id: "subtract", label: "−", kind: "op", ariaLabel: "Minus" },
  digit("4"),
  digit("5"),
  digit("6"),
  { id: "add", label: "+", kind: "op", ariaLabel: "Plus" },
  digit("1"),
  digit("2"),
  digit("3"),
  { id: "equals", label: "=", kind: "equals", ariaLabel: "Equals", rowSpan: 2 },
  { ...digit("0"), span: 2 },
  { id: "decimal", label: ".", kind: "num", ariaLabel: "Decimal point" },
];

const PHYSICAL_KEYS: Record<string, KeyId> = {
  ".": "decimal",
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
  "^": "power",
  "%": "percent",
  r: "sqrt",
  R: "sqrt",
  Enter: "equals",
  "=": "equals",
  Backspace: "backspace",
  Delete: "clearEntry",
  Escape: "clear",
};

/** The keypad key a physical keyboard key stands for, or null. */
export function keyIdForPhysicalKey(key: string): KeyId | null {
  return isDigitId(key) ? key : (PHYSICAL_KEYS[key] ?? null);
}
