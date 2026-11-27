import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { apiClient } from "../api/client";
import { server } from "../mocks/node";

window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }) as unknown as MediaQueryList;

const defaultTimeout = apiClient.defaults.timeout;

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  apiClient.defaults.timeout = defaultTimeout;
  vi.restoreAllMocks();
});

afterAll(() => server.close());
