import type { SxProps, Theme } from "@mui/material/styles";
import { MONO_FONT } from "../../theme";

export const panelSx: SxProps<Theme> = {
  flex: { md: "1 1 420px" },
  maxWidth: { md: 560 },
  minWidth: 0,
  overflow: "hidden",
  outline: "none",
  "&:focus-visible": {
    outline: "2px solid",
    outlineColor: "primary.main",
    outlineOffset: -2,
  },
};

export const outputSx: SxProps<Theme> = {
  display: "block",
  p: 3,
  textAlign: "right",
  fontFamily: MONO_FONT,
};

export const pendingLineSx: SxProps<Theme> = {
  display: "block",
  minHeight: 20,
  fontFamily: "inherit",
  fontSize: 14,
  overflowWrap: "anywhere",
  color: "text.secondary",
};

export const valueSx = (isError: boolean): SxProps<Theme> => ({
  display: "block",
  minHeight: 56,
  fontFamily: "inherit",
  fontSize: isError ? 24 : 48,
  overflowWrap: "anywhere",
  color: isError ? "error.main" : "text.primary",
});

export const progressSlotSx: SxProps<Theme> = { height: 4 };
