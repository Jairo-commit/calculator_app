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

interface CallOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Reads the JSON body of a response, or null when it is not JSON. An abort
 * while reading is not a bad body, so it is rethrown for the caller to map.
 */
async function readJson(
  response: Response,
  controller: AbortController,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (e) {
    if (controller.signal.aborted) throw e;
    return null;
  }
}

/** Runs one operation on the backend: POST /api/<op>. */
export async function callOperation(
  op: Operation,
  operands: Operands,
  { signal, timeoutMs = REQUEST_TIMEOUT_MS }: CallOptions = {},
): Promise<number> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abortFromCaller);

  try {
    let response: Response;
    let body: { result?: unknown; error?: unknown } | null;
    try {
      response = await fetch(`/api/${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operands),
        signal: controller.signal,
      });
      body = (await readJson(response, controller)) as typeof body;
    } catch (e) {
      // A caller abort is not a server problem: let it propagate untouched.
      if (signal?.aborted) throw e;
      throw new ServerUnavailableError(timedOut ? "timeout" : "network");
    }

    if (response.ok && typeof body?.result === "number") return body.result;
    if (response.status === 400 && typeof body?.error === "string") {
      throw new ApiValidationError(body.error);
    }
    throw new ServerUnavailableError("server");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
