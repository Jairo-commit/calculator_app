import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { vi } from "vitest";
import { api } from "../api/calculate";
import type { Operation } from "../lib/calculator";

type Config = InternalAxiosRequestConfig;
export type Adapter = (config: Config) => Promise<AxiosResponse>;

export const DIVIDE_BY_ZERO = "Can’t divide by zero";

const OPS: Record<Operation, (a: number, b: number) => number> = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b,
  power: (a, b) => a ** b,
  sqrt: Math.sqrt,
  percent: (a) => a / 100,
};

/** What the Go backend answers for an operation. */
export function evaluate(
  op: Operation,
  a: number,
  b = 0,
): { result: number } | { error: string } {
  return op === "divide" && b === 0
    ? { error: DIVIDE_BY_ZERO }
    : { result: OPS[op](a, b) };
}

/** Settles like axios: a response for 2xx, an AxiosError carrying it otherwise. */
export function reply(
  config: Config,
  status: number,
  data: unknown,
): Promise<AxiosResponse> {
  const response = { data, status, statusText: "", headers: {}, config };
  return status < 300
    ? Promise.resolve(response)
    : Promise.reject(
        new AxiosError(
          "Request failed",
          `ERR_${status}`,
          config,
          null,
          response,
        ),
      );
}

/** An axios failure that has no response: ERR_NETWORK or ECONNABORTED (timeout). */
export const fail =
  (code: string): Adapter =>
  (config) =>
    Promise.reject(new AxiosError(code, code, config));

export const bodyOf = (config: Config): unknown => JSON.parse(config.data);

export const fakeBackend: Adapter = (config) => {
  const { a, b } = bodyOf(config) as { a: number; b?: number };
  const answer = evaluate((config.url ?? "").slice(1) as Operation, a, b);
  return reply(config, "error" in answer ? 400 : 200, answer);
};

/** Routes the app's axios instance to a fake; setup restores it after the test. */
export function stubBackend(adapter: Adapter = fakeBackend) {
  const mock = vi.fn(adapter);
  api.defaults.adapter = mock;
  return mock;
}
