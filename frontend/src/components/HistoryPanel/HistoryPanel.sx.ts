import type { SxProps, Theme } from "@mui/material/styles";

export const headerSx: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  px: 2,
  py: 1,
};

export const emptyMessageSx: SxProps<Theme> = { p: 5, textAlign: "center" };

export const entrySx: SxProps<Theme> = {
  minHeight: 44,
  display: "block",
  textAlign: "right",
};
