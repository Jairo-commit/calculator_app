import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Operation, OperationCall } from "../lib/calculator";

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

export const server = setupServer();

export interface SentRequest {
  path: string;
  body: unknown;
}

export type Responder = (
  operation: string,
  body: unknown,
) => Response | Promise<Response>;

export const calculates: Responder = (operation, body) => {
  const answer = evaluate({ ...(body as object), operation } as OperationCall);
  return HttpResponse.json(answer, { status: "error" in answer ? 400 : 200 });
};

export const failsWithServerError: Responder = () =>
  HttpResponse.json({ error: "Internal server error" }, { status: 500 });

export const failsWithNetworkError: Responder = () => HttpResponse.error();

export const neverAnswers: Responder = async () => {
  await delay("infinite");
  return HttpResponse.error();
};

export const failsOnceThenCalculates = (firstAnswer: Responder): Responder => {
  let answered = false;
  return (operation, body) => {
    const responder = answered ? calculates : firstAnswer;
    answered = true;
    return responder(operation, body);
  };
};

export function mockBackend(responder: Responder = calculates): SentRequest[] {
  const sent: SentRequest[] = [];
  server.use(
    http.post("/api/:operation", async ({ request, params }) => {
      const body = await request.json();
      sent.push({ path: new URL(request.url).pathname, body });
      return responder(String(params.operation), body);
    }),
  );
  return sent;
}
