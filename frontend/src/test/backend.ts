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

/** What the Go backend answers for an operation. */
export function evaluate(
  operation: Operation,
  firstOperand: number,
  secondOperand = 0,
): { result: number } | { error: string } {
  return operation === "divide" && secondOperand === 0
    ? { error: DIVIDE_BY_ZERO }
    : { result: OPERATIONS[operation](firstOperand, secondOperand) };
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
  const { a: firstOperand, b: secondOperand } = bodyOf(config) as {
    a: number;
    b?: number;
  };
  const answer = evaluate(
    (config.url ?? "").slice(1) as Operation,
    firstOperand,
    secondOperand,
  );
  return reply(config, "error" in answer ? 400 : 200, answer);
};

/** Routes the app's axios instance to a fake; setup restores it after the test. */
export function stubBackend(adapter: Adapter = fakeBackend) {
  const mock = vi.fn(adapter);
  api.defaults.adapter = mock;
  return mock;
}
