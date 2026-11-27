import type { SxProps, Theme } from "@mui/material/styles";

export const titleSx: SxProps<Theme> = { flexGrow: 1 };

export const mainSx: SxProps<Theme> = { maxWidth: 1040, py: { xs: 2, md: 5 } };

export const historyPaperSx: SxProps<Theme> = {
  flex: "1 1 300px",
  minWidth: 0,
};
