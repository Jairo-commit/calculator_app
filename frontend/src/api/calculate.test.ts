import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import type { OperationCall } from "../lib/calculator";
import { ApiValidationError, callOperation } from "./calculate";
import { bodyOf, fail, reply, stubBackend } from "../test/backend";

describe("callOperation", () => {
  it("posts the operands to /api/<operation> with a 10 s timeout and returns the result", async () => {
    const adapter = stubBackend((config) => reply(config, 200, { result: 5 }));

    await expect(
      callOperation({ operation: "add", firstOperand: 2, secondOperand: 3 }),
    ).resolves.toBe(5);

    const requestConfig = adapter.mock.calls[0][0];
    expect([
      requestConfig.baseURL,
      requestConfig.url,
      requestConfig.timeout,
    ]).toEqual(["/api", "/add", 10_000]);
    expect(bodyOf(requestConfig)).toEqual({
      firstOperand: 2,
      secondOperand: 3,
    });
  });

  it("does not compile a two-number operation without its second operand", () => {
    // @ts-expect-error secondOperand is required for add
    const call: OperationCall = { operation: "add", firstOperand: 2 };

    expect(call.operation).toBe("add");
  });

  it("maps a 400 to ApiValidationError with the server message", async () => {
    stubBackend((config) => reply(config, 400, { error: "Nope" }));

    await expect(
      callOperation({ operation: "sqrt", firstOperand: -1 }),
    ).rejects.toThrow(new ApiValidationError("Nope"));
  });

  it.each([
    ["a network failure", fail(AxiosError.ERR_NETWORK)],
    ["a timeout", fail(AxiosError.ECONNABORTED)],
    ["a 500", (config: Parameters<typeof reply>[0]) => reply(config, 500, {})],
    [
      "a 400 without an error message",
      (config: Parameters<typeof reply>[0]) =>
        reply(config, 400, "<html>Bad</html>"),
    ],
  ])("lets %s through as a non-validation error", async (_name, adapter) => {
    stubBackend(adapter);

    const error = await callOperation({
      operation: "sqrt",
      firstOperand: 1,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AxiosError);
    expect(error).not.toBeInstanceOf(ApiValidationError);
  });
});
