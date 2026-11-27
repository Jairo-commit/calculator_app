import type { BinaryOperation, UnaryOperation } from "./operation";

export type OperationCall =
  | { operation: UnaryOperation; firstOperand: number }
  | {
      operation: BinaryOperation;
      firstOperand: number;
      secondOperand: number;
    };
