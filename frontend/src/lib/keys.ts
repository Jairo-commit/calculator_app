import type { KeyDef, KeyId, KeyKind } from "../models/key";

const key = (
  id: KeyId,
  label: string,
  kind: KeyKind,
  aria = label,
  extra: Pick<KeyDef, "wide" | "tall"> = {},
): KeyDef => ({ id, label, kind, aria, ...extra });
const digit = (digitId: KeyId) => key(digitId, digitId, "num");

export const KEYPAD: readonly KeyDef[] = [
  key("clear", "C", "clear", "Clear", { wide: true }),
  key("backspace", "⌫", "util", "Backspace"),
  key("divide", "÷", "op", "Divide"),
  key("sqrt", "√", "fn", "Square root"),
  key("power", "xʸ", "fn", "Power"),
  key("percent", "%", "fn", "Percent"),
  key("multiply", "×", "op", "Multiply"),
  digit("7"),
  digit("8"),
  digit("9"),
  key("subtract", "−", "op", "Minus"),
  digit("4"),
  digit("5"),
  digit("6"),
  key("add", "+", "op", "Plus"),
  digit("1"),
  digit("2"),
  digit("3"),
  key("equals", "=", "equals", "Equals", { tall: true }),
  { ...digit("0"), wide: true },
  key("decimal", ".", "num", "Decimal point"),
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
  Escape: "clear",
};

export const keyIdFor = (physical: string): KeyId | null =>
  /^\d$/.test(physical)
    ? (physical as KeyId)
    : (PHYSICAL_KEYS[physical] ?? null);
