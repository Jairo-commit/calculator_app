import axios from "axios";
import type { OperationCall } from "../lib/calculator";
import { apiClient } from "./client";

export class ApiValidationError extends Error {}

export async function callOperation({
  operation,
  ...operands
}: OperationCall): Promise<number> {
  try {
    const { data } = await apiClient.post<{ result: number }>(
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
