import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createQueryClient } from "../api/queryClient";

/** A wrapper with its own QueryClient, so no test sees another's mutations. */
export function createQueryWrapper() {
  const client = createQueryClient();
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}
