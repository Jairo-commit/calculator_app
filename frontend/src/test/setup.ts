import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { apiClient } from "../api/client";
import { server } from "../mocks/node";

let width = 1280;
export const setViewportWidth = (pixels: number) => {
  width = pixels;
};

window.matchMedia = (query: string) => {
  const minWidthMatch = /\(min-width:\s*([\d.]+)px\)/.exec(query);
  const maxWidthMatch = /\(max-width:\s*([\d.]+)px\)/.exec(query);
  return {
    matches:
      !(minWidthMatch && width < +minWidthMatch[1]) &&
      !(maxWidthMatch && width > +maxWidthMatch[1]),
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  } as unknown as MediaQueryList;
};

const defaultTimeout = apiClient.defaults.timeout;

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));

afterEach(() => {
  cleanup();
  setViewportWidth(1280);
  localStorage.clear();
  server.resetHandlers();
  server.events.removeAllListeners();
  apiClient.defaults.timeout = defaultTimeout;
  vi.restoreAllMocks();
});

afterAll(() => server.close());
