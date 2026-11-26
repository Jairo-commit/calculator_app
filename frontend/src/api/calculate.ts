import axios from "axios";
import type { Operation } from "../lib/calculator";

/** The server rejected the operands (HTTP 400); the user can fix them. */
export class ApiValidationError extends Error {}

/** The one HTTP client; the Vite proxy sends /api to the backend. */
export const api = axios.create({ baseURL: "/api", timeout: 10_000 });

/** POST /api/<op>. A 400 becomes ApiValidationError; anything else (network, timeout, 5xx) is rethrown as is. */
export async function callOperation(
  op: Operation,
  operands: { a: number; b?: number },
): Promise<number> {
  try {
    const { data } = await api.post<{ result: number }>(`/${op}`, operands);
    return data.result;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 400) {
      throw new ApiValidationError(e.response.data.error);
    }
    throw e;
  }
}
