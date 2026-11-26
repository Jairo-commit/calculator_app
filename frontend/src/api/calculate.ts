import axios, { AxiosError } from "axios";
import type { Operation } from "../lib/calculator";

export const REQUEST_TIMEOUT_MS = 10_000;

/** The server rejected the operands (HTTP 400): the user can fix it. */
export class ApiValidationError extends Error {
  override name = "ApiValidationError";
}

/** The server could not be used: unreachable, too slow or failing. */
export class ServerUnavailableError extends Error {
  override name = "ServerUnavailableError";

  constructor(readonly kind: "network" | "timeout" | "server") {
    super(`Server unavailable (${kind})`);
  }
}

/** The request body: unary operations send only `a`. */
export type Operands = { a: number } | { a: number; b: number };

/** The one HTTP client of the app; the Vite proxy sends /api to the backend. */
export const api = axios.create({
  baseURL: "/api",
  timeout: REQUEST_TIMEOUT_MS,
});

const TIMEOUT_CODES = new Set<string | undefined>([
  AxiosError.ECONNABORTED,
  AxiosError.ETIMEDOUT,
]);

function errorMessageOf(data: unknown): string | null {
  const error = (data as { error?: unknown } | null)?.error;
  return typeof error === "string" ? error : null;
}

/** Turns an axios failure into the two errors the calculator understands. */
function mapError(e: AxiosError): Error {
  if (TIMEOUT_CODES.has(e.code)) return new ServerUnavailableError("timeout");
  if (!e.response) {
    return new ServerUnavailableError(
      e.code === "ERR_BAD_RESPONSE" ? "server" : "network",
    );
  }
  const message = errorMessageOf(e.response.data);
  if (e.response.status === 400 && message !== null) {
    return new ApiValidationError(message);
  }
  return new ServerUnavailableError("server");
}

/** Runs one operation on the backend: POST /api/<op>. */
export async function callOperation(
  op: Operation,
  operands: Operands,
): Promise<number> {
  try {
    const { data } = await api.post<{ result?: unknown }>(`/${op}`, operands);
    if (typeof data?.result === "number") return data.result;
  } catch (e) {
    if (axios.isAxiosError(e)) throw mapError(e);
    throw e;
  }
  throw new ServerUnavailableError("server");
}
