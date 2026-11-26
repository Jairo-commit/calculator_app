import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import {
  REQUEST_TIMEOUT_MS,
  ApiValidationError,
  api,
  callOperation,
} from "./calculate";
import {
  bodyOf,
  networkError,
  pathOf,
  reply,
  timeoutError,
  type Adapter,
} from "../test/fakeBackend";

/** Replaces the HTTP layer of the app's axios instance for one test. */
function useAdapter(adapter: Adapter) {
  const mock = vi.fn(adapter);
  api.defaults.adapter = mock;
  return mock;
}

describe("callOperation", () => {
  it("posts binary operands to /api/<op> and returns the result", async () => {
    const adapter = useAdapter((c) => reply(c, 200, { result: 5 }));

    await expect(callOperation("add", { a: 2, b: 3 })).resolves.toBe(5);

    const config = adapter.mock.calls[0][0];
    expect(pathOf(config)).toBe("/api/add");
    expect(config.method).toBe("post");
    expect(bodyOf(config)).toEqual({ a: 2, b: 3 });
  });

  it("posts only a for a unary operation", async () => {
    const adapter = useAdapter((c) => reply(c, 200, { result: 3 }));

    await expect(callOperation("sqrt", { a: 9 })).resolves.toBe(3);

    const config = adapter.mock.calls[0][0];
    expect(pathOf(config)).toBe("/api/sqrt");
    expect(bodyOf(config)).toEqual({ a: 9 });
  });

  it("maps 400 to ApiValidationError with the server message", async () => {
    useAdapter((c) => reply(c, 400, { error: "Can’t divide by zero" }));

    const error = await callOperation("divide", { a: 48, b: 0 }).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(ApiValidationError);
    expect(error.message).toBe("Can’t divide by zero");
  });

  it.each([
    ["a 500", (c: Parameters<Adapter>[0]) => reply(c, 500, { error: "x" })],
    ["a 404", (c: Parameters<Adapter>[0]) => reply(c, 404, "Not found")],
    [
      "a 200 with a non-JSON body",
      (c: Parameters<Adapter>[0]) => reply(c, 200, "<html>"),
    ],
    [
      "a 200 without a numeric result",
      (c: Parameters<Adapter>[0]) => reply(c, 200, { result: "16" }),
    ],
    [
      "a 400 without an error message",
      (c: Parameters<Adapter>[0]) => reply(c, 400, {}),
    ],
    [
      "an unparseable response",
      (c: Parameters<Adapter>[0]) =>
        Promise.reject(
          new AxiosError("bad body", AxiosError.ERR_BAD_RESPONSE, c),
        ),
    ],
  ])("maps %s to ServerUnavailableError(server)", async (_name, respond) => {
    useAdapter(respond);

    await expect(callOperation("sqrt", { a: 1 })).rejects.toMatchObject({
      name: "ServerUnavailableError",
      kind: "server",
    });
  });

  it("maps a request with no response to ServerUnavailableError(network)", async () => {
    useAdapter(networkError);

    await expect(callOperation("sqrt", { a: 1 })).rejects.toMatchObject({
      name: "ServerUnavailableError",
      kind: "network",
    });
  });

  it("does not hide errors that did not come from axios", async () => {
    useAdapter(() => Promise.reject(new RangeError("bug")));

    await expect(callOperation("sqrt", { a: 1 })).rejects.toBeInstanceOf(
      RangeError,
    );
  });
});

describe("callOperation timeout", () => {
  it("asks axios to give up after 10 seconds", async () => {
    const adapter = useAdapter((c) => reply(c, 200, { result: 1 }));

    await callOperation("sqrt", { a: 1 });

    expect(adapter.mock.calls[0][0].timeout).toBe(10_000);
    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
  });

  it.each([AxiosError.ECONNABORTED, AxiosError.ETIMEDOUT])(
    "maps %s to ServerUnavailableError(timeout)",
    async (code) => {
      useAdapter((c) =>
        Promise.reject(new AxiosError("timeout of 10000ms exceeded", code, c)),
      );

      await expect(callOperation("sqrt", { a: 1 })).rejects.toMatchObject({
        name: "ServerUnavailableError",
        kind: "timeout",
      });
    },
  );

  it("maps the error axios raises when the timeout passes", async () => {
    useAdapter(timeoutError);

    await expect(callOperation("sqrt", { a: 1 })).rejects.toMatchObject({
      kind: "timeout",
    });
  });
});
