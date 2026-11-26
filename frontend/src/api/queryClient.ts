import { QueryClient } from "@tanstack/react-query";

/** The app's query client: a failed calculation is retried by the user only. */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}
