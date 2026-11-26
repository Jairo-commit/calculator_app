import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { ApiValidationError, callOperation } from "./calculate";
import { bodyOf, fail, reply, stubBackend } from "../test/backend";

describe("callOperation", () => {
  it("posts the operands to /api/<op> with a 10 s timeout and returns the result", async () => {
    const adapter = stubBackend((c) => reply(c, 200, { result: 5 }));

    await expect(callOperation("add", { a: 2, b: 3 })).resolves.toBe(5);

    const config = adapter.mock.calls[0][0];
    expect([config.baseURL, config.url, config.timeout]).toEqual([
      "/api",
      "/add",
      10_000,
    ]);
    expect(bodyOf(config)).toEqual({ a: 2, b: 3 });
  });

  it("maps a 400 to ApiValidationError with the server message", async () => {
    stubBackend((c) => reply(c, 400, { error: "Nope" }));

    await expect(callOperation("sqrt", { a: -1 })).rejects.toThrow(
      new ApiValidationError("Nope"),
    );
  });

  it.each([
    ["a network failure", fail(AxiosError.ERR_NETWORK)],
    ["a timeout", fail(AxiosError.ECONNABORTED)],
    ["a 500", (c: Parameters<typeof reply>[0]) => reply(c, 500, {})],
  ])("lets %s through as a non-validation error", async (_name, adapter) => {
    stubBackend(adapter);

    const error = await callOperation("sqrt", { a: 1 }).catch((e) => e);

    expect(error).toBeInstanceOf(AxiosError);
    expect(error).not.toBeInstanceOf(ApiValidationError);
  });
});
