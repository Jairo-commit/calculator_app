export const REQUEST_TIMEOUT_MS = 10_000;

/** The server rejected the expression (HTTP 400): the user can fix it. */
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

interface CalculateOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Reads the JSON body of a response, or null when it is not JSON. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function calculateRemote(
  expression: string,
  { signal, timeoutMs = REQUEST_TIMEOUT_MS }: CalculateOptions = {},
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
    try {
      response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression }),
        signal: controller.signal,
      });
    } catch (e) {
      // A caller abort is not a server problem: let it propagate untouched.
      if (signal?.aborted) throw e;
      throw new ServerUnavailableError(timedOut ? "timeout" : "network");
    }

    const body = (await readJson(response)) as {
      result?: unknown;
      error?: unknown;
    } | null;

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
