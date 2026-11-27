import type { SxProps, Theme } from "@mui/material/styles";

export const panelSx: SxProps<Theme> = {
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
};

export const valueSx: SxProps<Theme> = { minHeight: 56 };

export const progressSlotSx: SxProps<Theme> = { height: 4 };
