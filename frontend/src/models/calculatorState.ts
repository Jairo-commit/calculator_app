import type { BinaryOperation } from "./operation";

export interface PendingOperation {
  operation: BinaryOperation;
  value: number;
  text: string;
}

export interface CalculatorState {
  text: string;
  value: number;
  startsNewNumber: boolean;
  pending: PendingOperation | null;
  hasSecondOperand: boolean;
  error: string | null;
  finishedEquation: string | null;
}
