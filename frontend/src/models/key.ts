import type { Operation } from "./operation";

export type KeyId =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "decimal"
  | Operation
  | "equals"
  | "clear"
  | "backspace";

export type KeyKind = "num" | "op" | "fn" | "util" | "clear" | "equals";

export interface KeyDef {
  id: KeyId;
  label: string;
  kind: KeyKind;
  aria: string;
  wide?: true;
  tall?: true;
}
