import { AxiosError } from "axios";
import { HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { OperationCall } from "../lib/calculator";
import {
  failsWithNetworkError,
  failsWithServerError,
  mockBackend,
  neverAnswers,
  type Responder,
} from "../test/backend";
import { ApiValidationError, api, callOperation } from "./calculate";

describe("callOperation", () => {
  it("posts the operands to /api/<operation>", async () => {
    const sent = mockBackend();

    await callOperation({
      operation: "add",
      firstOperand: 2,
      secondOperand: 3,
    });

    expect(sent).toEqual([
      { path: "/api/add", body: { firstOperand: 2, secondOperand: 3 } },
    ]);
  });

  it("returns the result from the response", async () => {
    mockBackend();

    await expect(
      callOperation({ operation: "add", firstOperand: 2, secondOperand: 3 }),
    ).resolves.toBe(5);
  });

  it("gives up on a request after 10 seconds", () => {
    expect(api.defaults.timeout).toBe(10_000);
  });

  it("does not compile a two-number operation without its second operand", () => {
    // @ts-expect-error secondOperand is required for add
    const call: OperationCall = { operation: "add", firstOperand: 2 };

    expect(call.operation).toBe("add");
  });

  it("maps a 400 to ApiValidationError with the server message", async () => {
    mockBackend(() => HttpResponse.json({ error: "Nope" }, { status: 400 }));

    await expect(
      callOperation({ operation: "sqrt", firstOperand: -1 }),
    ).rejects.toThrow(new ApiValidationError("Nope"));
  });

  it.each<[string, Responder]>([
    ["a network failure", failsWithNetworkError],
    ["a 500", failsWithServerError],
    [
      "a 400 without an error message",
      () => new HttpResponse("<html>Bad</html>", { status: 400 }),
    ],
  ])("lets %s through as a non-validation error", async (_name, responder) => {
    mockBackend(responder);

    const error = await callOperation({
      operation: "sqrt",
      firstOperand: 1,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AxiosError);
    expect(error).not.toBeInstanceOf(ApiValidationError);
  });

  it("lets a timeout through as a non-validation error", async () => {
    api.defaults.timeout = 50;
    mockBackend(neverAnswers);

    const error = await callOperation({
      operation: "sqrt",
      firstOperand: 1,
    }).catch((caught) => caught);

    expect(error).toMatchObject({ code: AxiosError.ECONNABORTED });
  });
});
