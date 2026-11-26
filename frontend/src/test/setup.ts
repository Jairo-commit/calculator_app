import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { api } from "../api/calculate";

/** Viewport width the matchMedia stub reports; tests change it with setViewportWidth. */
let viewportWidth = 1280;

export function setViewportWidth(width: number): void {
  viewportWidth = width;
}

/** Evaluates the min/max-width queries MUI breakpoints produce. */
function matches(query: string): boolean {
  const min = /\(min-width:\s*([\d.]+)px\)/.exec(query);
  const max = /\(max-width:\s*([\d.]+)px\)/.exec(query);
  if (min && viewportWidth < Number(min[1])) return false;
  if (max && viewportWidth > Number(max[1])) return false;
  return true;
}

/** The adapter a test replaces to fake the backend; restored after each test. */
const realAdapter = api.defaults.adapter;

window.matchMedia = (query: string): MediaQueryList =>
  ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

afterEach(() => {
  cleanup();
  setViewportWidth(1280);
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  api.defaults.adapter = realAdapter;
});
