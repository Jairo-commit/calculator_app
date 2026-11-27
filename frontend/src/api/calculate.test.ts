import { AxiosError } from "axios";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { OperationCall } from "../models/operationCall";
import { OPERATION_URL } from "../mocks/handlers";
import { server } from "../mocks/node";
import { recordRequests } from "../test/requests";
import { ApiValidationError, callOperation } from "./calculate";
import { apiClient } from "./client";

const sqrtOfOne = () =>
  callOperation({ operation: "sqrt", firstOperand: 1 }).catch(
    (caught: unknown) => caught,
  );

describe("callOperation", () => {
  it("posts the operands to /api/<operation>", async () => {
    const sentRequests = recordRequests();

    await callOperation({
      operation: "add",
      firstOperand: 2,
      secondOperand: 3,
    });

    expect(await sentRequests()).toEqual([
      { path: "/api/add", body: { firstOperand: 2, secondOperand: 3 } },
    ]);
  });

  it("returns the result from the response", async () => {
    await expect(
      callOperation({ operation: "add", firstOperand: 2, secondOperand: 3 }),
    ).resolves.toBe(5);
  });

  it("gives up on a request after 10 seconds", () => {
    expect(apiClient.defaults.timeout).toBe(10_000);
  });

  it("does not compile a two-number operation without its second operand", () => {
    // @ts-expect-error secondOperand is required for add
    const call: OperationCall = { operation: "add", firstOperand: 2 };

    expect(call.operation).toBe("add");
  });

  it("maps a 400 to ApiValidationError with the server message", async () => {
    server.use(
      http.post(OPERATION_URL, () =>
        HttpResponse.json({ error: "Nope" }, { status: 400 }),
      ),
    );

    await expect(
      callOperation({ operation: "sqrt", firstOperand: -1 }),
    ).rejects.toThrow(new ApiValidationError("Nope"));
  });

  it.each([
    ["a network failure", () => HttpResponse.error()],
    [
      "a 500",
      () =>
        HttpResponse.json({ error: "Internal server error" }, { status: 500 }),
    ],
    [
      "a 400 without an error message",
      () => new HttpResponse("<html>Bad</html>", { status: 400 }),
    ],
  ])("lets %s through as a non-validation error", async (_name, resolver) => {
    server.use(http.post(OPERATION_URL, resolver));

    const error = await sqrtOfOne();

    expect(error).toBeInstanceOf(AxiosError);
    expect(error).not.toBeInstanceOf(ApiValidationError);
  });

  it("lets a timeout through as a non-validation error", async () => {
    apiClient.defaults.timeout = 50;
    server.use(
      http.post(OPERATION_URL, async () => {
        await delay("infinite");
      }),
    );

    const error = await sqrtOfOne();

    expect(error).toMatchObject({ code: AxiosError.ECONNABORTED });
  });
});
