import { http, HttpResponse } from "msw";
import type { Operation, OperationCall } from "../lib/calculator";

export const OPERATION_URL = "/api/:operation";

export const DIVIDE_BY_ZERO = "Can’t divide by zero";

const OPERATIONS: Record<
  Operation,
  (firstOperand: number, secondOperand: number) => number
> = {
  add: (firstOperand, secondOperand) => firstOperand + secondOperand,
  subtract: (firstOperand, secondOperand) => firstOperand - secondOperand,
  multiply: (firstOperand, secondOperand) => firstOperand * secondOperand,
  divide: (firstOperand, secondOperand) => firstOperand / secondOperand,
  power: (firstOperand, secondOperand) => firstOperand ** secondOperand,
  sqrt: Math.sqrt,
  percent: (firstOperand) => firstOperand / 100,
};

export function evaluate(
  call: OperationCall,
): { result: number } | { error: string } {
  const secondOperand = "secondOperand" in call ? call.secondOperand : 0;
  return call.operation === "divide" && secondOperand === 0
    ? { error: DIVIDE_BY_ZERO }
    : { result: OPERATIONS[call.operation](call.firstOperand, secondOperand) };
}

export const handlers = [
  http.post(OPERATION_URL, async ({ request, params }) => {
    const operands = (await request.json()) as object;
    const answer = evaluate({
      ...operands,
      operation: params.operation,
    } as OperationCall);
    return HttpResponse.json(answer, { status: "error" in answer ? 400 : 200 });
  }),
];
