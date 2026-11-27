import { describe, expect, it } from "vitest";
import { formatResult } from "./operations";

describe("formatResult", () => {
  it.each([
    ["groups thousands", 1234567.5, "1,234,567.5"],
    ["rounds to 10 decimals", 0.33333333333333, "0.3333333333"],
    ["uses a true minus sign", -999999999999999, "−999,999,999,999,999"],
    ["shows the smallest result above zero in full", 1e-10, "0.0000000001"],
    [
      "shows 15 significant digits with decimals",
      17636684.1428571,
      "17,636,684.1428571",
    ],
  ])("%s", (_name, value, expected) => {
    expect(formatResult(value)).toBe(expected);
  });
});
