import { describe, expect, it } from "vitest";
import { theme } from "../../theme";
import { fittedValueSx } from "./CalculatorPanel.sx";

describe("fittedValueSx", () => {
  it("never makes the result larger than the display typography", () => {
    expect(fittedValueSx(1)(theme).fontSize).toBe(
      "min(48px, calc(100cqi / 1 / 0.6))",
    );
  });

  it("shrinks the longest result, −999,999,999,999,999, to fit one line", () => {
    expect(fittedValueSx(20)(theme).fontSize).toBe(
      "min(48px, calc(100cqi / 20 / 0.6))",
    );
  });
});
