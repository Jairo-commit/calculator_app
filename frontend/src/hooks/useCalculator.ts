import { useMutation } from "@tanstack/react-query";
import { useReducer, useState } from "react";
import { ApiValidationError, callOperation } from "../api/calculate";
import {
  displayOf,
  initialState,
  reducer,
  requestFor,
} from "../lib/calculatorReducer";
import type { KeyId } from "../models/key";
import type { OperationRequest } from "../models/operationRequest";

export function useCalculator() {
  const [calculatorState, dispatch] = useReducer(reducer, initialState);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const {
    mutate: postOperation,
    reset: discardRequest,
    isPending: isCalculating,
    variables: lastRequest,
  } = useMutation({
    mutationFn: ({ operationCall }: OperationRequest) =>
      callOperation(operationCall),
  });

  const sendRequest = (request: OperationRequest) =>
    postOperation(request, {
      onSuccess: (result) => dispatch({ type: "succeeded", request, result }),
      onError: (error) =>
        error instanceof ApiValidationError
          ? dispatch({ type: "rejected", message: error.message })
          : setIsSnackbarOpen(true),
    });

  const press = (keyId: KeyId) => {
    if (keyId === "clear") discardRequest();
    else if (isCalculating) return;
    setIsSnackbarOpen(false);
    const request = requestFor(calculatorState, keyId);
    if (request) sendRequest(request);
    else dispatch({ type: "key", id: keyId });
  };

  return {
    press,
    loading: isCalculating,
    display: displayOf(calculatorState),
    snackbarOpen: isSnackbarOpen,
    dismiss: () => setIsSnackbarOpen(false),
    retry: () => {
      if (!lastRequest) {
        throw new Error("Retry pressed without a failed request");
      }
      setIsSnackbarOpen(false);
      sendRequest(lastRequest);
    },
  };
}
