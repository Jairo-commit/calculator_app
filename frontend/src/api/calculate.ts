import axios from "axios";
import type { Operation } from "../lib/calculator";

/** The server rejected the operands (HTTP 400); the user can fix them. */
export class ApiValidationError extends Error {}

/** The one HTTP client; the Vite proxy sends /api to the backend. */
export const api = axios.create({ baseURL: "/api", timeout: 10_000 });

/** POST /api/<operation>. A 400 with an error message becomes ApiValidationError; anything else (network, timeout, 5xx) is rethrown as is. */
export async function callOperation(
  operation: Operation,
  operands: { firstOperand: number; secondOperand?: number },
): Promise<number> {
  try {
    // The wire contract names the operands a and b.
    const { data } = await api.post<{ result: number }>(`/${operation}`, {
      a: operands.firstOperand,
      b: operands.secondOperand,
    });
    return data.result;
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 400 &&
      typeof error.response.data?.error === "string"
    ) {
      throw new ApiValidationError(error.response.data.error);
    }
    throw error;
  }
}
