import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { api } from "../api/calculate";

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

const realAdapter = api.defaults.adapter;

afterEach(() => {
  cleanup();
  setViewportWidth(1280);
  localStorage.clear();
  api.defaults.adapter = realAdapter;
  vi.restoreAllMocks();
});
