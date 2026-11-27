import { http, HttpResponse } from "msw";
import type { ErrorResponse, ResultResponse } from "../models/apiResponses";
import type { Operation } from "../models/operation";
import type { OperationCall } from "../models/operationCall";

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
  operationCall: OperationCall,
): ResultResponse | ErrorResponse {
  const secondOperand =
    "secondOperand" in operationCall ? operationCall.secondOperand : 0;
  return operationCall.operation === "divide" && secondOperand === 0
    ? { error: DIVIDE_BY_ZERO }
    : {
        result: OPERATIONS[operationCall.operation](
          operationCall.firstOperand,
          secondOperand,
        ),
      };
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
