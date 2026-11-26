import { useMutation } from "@tanstack/react-query";
import { useEffect, useReducer, useState } from "react";
import { ApiValidationError, callOperation } from "../api/calculate";
import type { KeyId } from "../lib/calculator";
import {
  displayOf,
  initialState,
  reducer,
  requestFor,
  type Request,
} from "../lib/calculatorState";
import { saveHistory } from "../lib/history";

export function useCalculator() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const { mutate, reset, isPending, variables } = useMutation({
    mutationFn: ({ operation, firstOperand, secondOperand }: Request) =>
      callOperation(operation, { firstOperand, secondOperand }),
    retry: false,
  });

  useEffect(() => saveHistory(state.history), [state.history]);

  const send = (request: Request) =>
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
    history: state.history,
    reuse: (result: number) => {
      setSnackbarOpen(false);
      dispatch({ type: "reuse", result });
    },
    clearHistory: () => dispatch({ type: "clearHistory" }),
    snackbarOpen,
    dismiss: () => setSnackbarOpen(false),
    retry: () => {
      setSnackbarOpen(false);
      if (variables) send(variables);
    },
  };
}
