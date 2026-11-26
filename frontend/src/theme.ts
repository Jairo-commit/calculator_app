import { createTheme } from "@mui/material/styles";
import type { KeyKind } from "./lib/calculator";

export const MONO_FONT = '"Roboto Mono", ui-monospace, monospace';

/** Colours that are not part of the MUI palette. */
export const tokens = {
  primaryTint: "#e3f2fd",
  keypadBg: "#fafafa",
  alertBg: "#fdeded",
  alertText: "#5f2120",
} as const;

export interface KeyColor {
  bg: string;
  text: string;
  border: string;
  hover: string;
}

const TEXT_PRIMARY = "rgba(0,0,0,0.87)";

/** Keypad colours by key kind. `equals` uses the primary contained button. */
export const keyColors: Record<KeyKind, KeyColor> = {
  num: {
    bg: "#fff",
    text: TEXT_PRIMARY,
    border: "rgba(0,0,0,0.23)",
    hover: "#f5f5f5",
  },
  op: { bg: "#e3f2fd", text: "#0d47a1", border: "none", hover: "#bbdefb" },
  fn: { bg: "#f3e5f5", text: "#6a1b9a", border: "none", hover: "#e1bee7" },
  util: { bg: "#f5f5f5", text: TEXT_PRIMARY, border: "none", hover: "#eeeeee" },
  clear: {
    bg: "#fff",
    text: "#d32f2f",
    border: "rgba(211,47,47,0.5)",
    hover: "rgba(211,47,47,0.04)",
  },
  equals: { bg: "#1976d2", text: "#fff", border: "none", hover: "#1565c0" },
};

export const theme = createTheme({
  palette: {
    primary: { main: "#1976d2", dark: "#1565c0" },
    error: { main: "#d32f2f" },
    background: { default: "#f5f5f5" },
    text: {
      primary: TEXT_PRIMARY,
      secondary: "rgba(0,0,0,0.6)",
      disabled: "rgba(0,0,0,0.38)",
    },
  },
  shape: { borderRadius: 4 },
  typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&.Mui-focusVisible": {
            outline: "2px solid #1976d2",
            outlineOffset: 2,
          },
        },
      },
    },
  },
});
