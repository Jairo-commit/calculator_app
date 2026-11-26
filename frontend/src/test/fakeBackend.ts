import type { Operation } from "../lib/calculator";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const OPERATIONS: Record<Operation, (a: number, b: number) => number> = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b,
  power: (a, b) => a ** b,
  sqrt: (a) => Math.sqrt(a),
  percent: (a) => a / 100,
};

/** A stand-in for the Go backend: one endpoint per operation. */
export function fakeBackend(url: string, init: RequestInit): Response {
  const op = url.replace("/api/", "") as Operation;
  const { a, b } = JSON.parse(init.body as string) as { a: number; b: number };
  if (op === "divide" && b === 0) {
    return json(400, { error: "Can’t divide by zero" });
  }
  return json(200, { result: OPERATIONS[op](a, b) });
}

export { json };
