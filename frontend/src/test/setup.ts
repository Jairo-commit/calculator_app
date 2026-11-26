import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { api } from "../api/calculate";

let width = 1280;
/** Sets the viewport width the matchMedia stub reports. */
export const setViewportWidth = (px: number) => {
  width = px;
};

window.matchMedia = (query: string) => {
  const min = /\(min-width:\s*([\d.]+)px\)/.exec(query);
  const max = /\(max-width:\s*([\d.]+)px\)/.exec(query);
  return {
    matches: !(min && width < +min[1]) && !(max && width > +max[1]),
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  } as unknown as MediaQueryList;
};

const realAdapter = api.defaults.adapter;

afterEach(() => {
  cleanup();
  setViewportWidth(1280);
  localStorage.clear();
  api.defaults.adapter = realAdapter;
  vi.restoreAllMocks();
});
