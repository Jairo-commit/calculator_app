import type { SxProps, Theme } from "@mui/material/styles";
import { MONO_FONT } from "../../theme";

export const headerSx: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  px: 2,
  py: 1,
};

export const headingSx: SxProps<Theme> = { fontSize: 16, fontWeight: 500 };

export const emptyMessageSx: SxProps<Theme> = {
  p: 5,
  textAlign: "center",
  color: "text.secondary",
};

export const entrySx: SxProps<Theme> = {
  minHeight: 44,
  display: "block",
  textAlign: "right",
};

export const entryExpressionSx: SxProps<Theme> = {
  display: "block",
  fontFamily: MONO_FONT,
  fontSize: 14,
  color: "text.secondary",
};

export const entryResultSx: SxProps<Theme> = {
  display: "block",
  fontFamily: MONO_FONT,
  fontSize: 20,
  fontWeight: 500,
};
