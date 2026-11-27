import { describe, expect, it } from "vitest";
import { HISTORY_KEY, HISTORY_LIMIT, loadHistory } from "./history";

const entry = (index: number) => ({ expr: `${index} + 0`, result: index });

describe("loadHistory", () => {
  it("drops saved entries without a text expression or a finite result", () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        entry(1),
        { expr: 2, result: 2 },
        { expr: "3 + 0", result: null },
        entry(4),
      ]),
    );

    expect(loadHistory()).toEqual([entry(1), entry(4)]);
  });

  it("returns an empty history when the saved value is not valid JSON", () => {
    localStorage.setItem(HISTORY_KEY, "{not json");

    expect(loadHistory()).toEqual([]);
  });

  it("loads only the newest 8 saved entries", () => {
    const saved = Array.from({ length: HISTORY_LIMIT + 2 }, (_, index) =>
      entry(index),
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(saved));

    expect(loadHistory()).toEqual(saved.slice(0, HISTORY_LIMIT));
  });
});
