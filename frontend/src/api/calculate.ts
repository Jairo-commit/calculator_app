import axios from "axios";
import type { Operation } from "../lib/calculator";

export class ApiValidationError extends Error {}

export const api = axios.create({ baseURL: "/api", timeout: 10_000 });

export async function callOperation(
  operation: Operation,
  operands: { firstOperand: number; secondOperand?: number },
): Promise<number> {
  try {
    const { data } = await api.post<{ result: number }>(
      `/${operation}`,
      operands,
    );
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
