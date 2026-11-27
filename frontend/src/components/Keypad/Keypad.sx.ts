import type { SxProps, Theme } from "@mui/material/styles";
import type { KeyDef } from "../../models/key";

export const keypadSx: SxProps<Theme> = (theme) => ({
  bgcolor: theme.palette.background.keypad,
  p: { xs: "16px", sm: "20px 24px 24px" },
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: { xs: "10px", sm: "12px" },
});

export const keySx = ({
  wide,
  tall,
}: Pick<KeyDef, "wide" | "tall">): SxProps<Theme> => ({
  height: tall ? "auto" : { xs: 64, sm: 56 },
  gridColumn: wide ? "span 2" : undefined,
  gridRow: tall ? "span 2" : undefined,
});
