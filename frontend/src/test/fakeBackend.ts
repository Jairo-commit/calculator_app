import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { Operation } from "../lib/calculator";

/** What an axios adapter is: the function that actually sends a request. */
export type Adapter = (
  config: InternalAxiosRequestConfig,
) => Promise<AxiosResponse>;

/**
 * The adapter's answer for a status, as axios would settle it: a response for
 * 2xx and an AxiosError carrying the response for anything else.
 */
export function reply(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): Promise<AxiosResponse> {
  const response: AxiosResponse = {
    data,
    status,
    statusText: "",
    headers: {},
    config,
  };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  const code =
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST;
  return Promise.reject(
    new AxiosError(
      `Request failed with status code ${status}`,
      code,
      config,
      null,
      response,
    ),
  );
}

/** The failure axios reports when the server cannot be reached at all. */
export function networkError(
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  return Promise.reject(
    new AxiosError("Network Error", AxiosError.ERR_NETWORK, config),
  );
}

/** The failure axios reports when `timeout` ms pass without an answer. */
export function timeoutError(
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  return Promise.reject(
    new AxiosError(
      `timeout of ${config.timeout}ms exceeded`,
      AxiosError.ECONNABORTED,
      config,
    ),
  );
}

/** The path a request goes to, e.g. "/api/add". */
export const pathOf = (config: InternalAxiosRequestConfig): string =>
  `${config.baseURL ?? ""}${config.url ?? ""}`;

/** The JSON body a request sends. */
export const bodyOf = (config: InternalAxiosRequestConfig): unknown =>
  JSON.parse(config.data as string);

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
export const fakeBackend: Adapter = (config) => {
  const op = (config.url ?? "").replace("/", "") as Operation;
  const { a, b } = bodyOf(config) as { a: number; b: number };
  if (op === "divide" && b === 0) {
    return reply(config, 400, { error: "Can’t divide by zero" });
  }
  return reply(config, 200, { result: OPERATIONS[op](a, b) });
};
