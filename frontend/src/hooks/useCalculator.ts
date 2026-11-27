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
  const [state, dispatch] = useReducer(reducer, initialState);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const { mutate, reset, isPending, variables } = useMutation({
    mutationFn: ({ call }: OperationRequest) => callOperation(call),
  });

  const send = (request: OperationRequest) =>
    mutate(request, {
      onSuccess: (result) => dispatch({ type: "succeeded", request, result }),
      onError: (error) =>
        error instanceof ApiValidationError
          ? dispatch({ type: "rejected", message: error.message })
          : setSnackbarOpen(true),
    });

  const press = (id: KeyId) => {
    if (id === "clear") reset();
    else if (isPending) return;
    setSnackbarOpen(false);
    const request = requestFor(state, id);
    if (request) send(request);
    else dispatch({ type: "key", id });
  };

  return {
    press,
    loading: isPending,
    display: displayOf(state),
    snackbarOpen,
    dismiss: () => setSnackbarOpen(false),
    retry: () => {
      if (!variables) {
        throw new Error("Retry pressed without a failed request");
      }
      setSnackbarOpen(false);
      send(variables);
    },
  };
}
