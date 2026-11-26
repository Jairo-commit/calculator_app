import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiValidationError,
  ServerUnavailableError,
  calculateRemote,
} from "./calculate";

function respond(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
  });
}

describe("calculateRemote", () => {
  it("posts the expression and returns the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { result: 60 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(calculateRemote("(12 + 8) × 3")).resolves.toBe(60);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/calculate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ expression: "(12 + 8) × 3" });
  });

  it("maps 400 to ApiValidationError with the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(respond(400, { error: "Can’t divide by zero" })),
    );

    const error = await calculateRemote("48 ÷ 0").catch((e) => e);

    expect(error).toBeInstanceOf(ApiValidationError);
    expect(error.message).toBe("Can’t divide by zero");
  });

  it.each([
    ["500", respond(500, { error: "Internal server error" })],
    ["a non-JSON body", respond(200, "<html>")],
    ["a 200 without a numeric result", respond(200, { result: "16" })],
    ["a 400 without an error message", respond(400, {})],
  ])("maps %s to ServerUnavailableError(server)", async (_name, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(calculateRemote("1")).rejects.toMatchObject({
      name: "ServerUnavailableError",
      kind: "server",
    });
  });

  it("maps a rejected fetch to ServerUnavailableError(network)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(calculateRemote("1")).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("lets a caller abort propagate as an AbortError", async () => {
    vi.stubGlobal("fetch", abortableFetch());
    const caller = new AbortController();

    const promise = calculateRemote("1", { signal: caller.signal });
    caller.abort();

    const error = await promise.catch((e) => e);
    expect(error).not.toBeInstanceOf(ServerUnavailableError);
    expect(error.name).toBe("AbortError");
  });

  it("aborts immediately when the caller signal is already aborted", async () => {
    vi.stubGlobal("fetch", abortableFetch());

    const error = await calculateRemote("1", {
      signal: AbortSignal.abort(),
    }).catch((e) => e);

    expect(error.name).toBe("AbortError");
  });
});

describe("calculateRemote timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives up after 10 seconds with a timeout error", async () => {
    vi.stubGlobal("fetch", abortableFetch());

    const promise = calculateRemote("1");
    const assertion = expect(promise).rejects.toMatchObject({
      kind: "timeout",
    });
    await vi.advanceTimersByTimeAsync(9_999);
    await vi.advanceTimersByTimeAsync(1);

    await assertion;
  });

  it("maps a timeout while the body is being read to a timeout error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        const body = new ReadableStream({
          start(controller) {
            init.signal?.addEventListener("abort", () =>
              controller.error(new DOMException("aborted", "AbortError")),
            );
          },
        });
        return Promise.resolve(new Response(body, { status: 200 }));
      }),
    );

    const promise = calculateRemote("1");
    const assertion = expect(promise).rejects.toMatchObject({
      name: "ServerUnavailableError",
      kind: "timeout",
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await assertion;
  });

  it("does not time out a request that finished in time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respond(200, { result: 1 })),
    );

    await expect(calculateRemote("1")).resolves.toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

/** A fetch that never answers but rejects with AbortError when aborted. */
function abortableFetch() {
  return vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (init.signal?.aborted) abort();
        init.signal?.addEventListener("abort", abort);
      }),
  );
}
