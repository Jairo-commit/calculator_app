import axios from "axios";
import type { ErrorResponse, ResultResponse } from "../models/apiResponses";
import type { OperationCall } from "../models/operationCall";
import { apiClient } from "./client";

export class ApiValidationError extends Error {}

export async function callOperation({
  operation,
  ...operands
}: OperationCall): Promise<number> {
  try {
    const { data } = await apiClient.post<ResultResponse>(
      `/${operation}`,
      operands,
    );
    return data.result;
  } catch (error) {
    if (
      axios.isAxiosError<Partial<ErrorResponse>>(error) &&
      error.response?.status === 400 &&
      typeof error.response.data?.error === "string"
    ) {
      throw new ApiValidationError(error.response.data.error);
    }
    throw error;
  }
}
