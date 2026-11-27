import { createTheme } from "@mui/material/styles";
import type { CSSProperties } from "react";

declare module "@mui/material/styles" {
  interface Palette {
    keypadNumber: Palette["primary"];
    keypadOperator: Palette["primary"];
    keypadFunction: Palette["primary"];
    keypadUtility: Palette["primary"];
  }
  interface PaletteOptions {
    keypadNumber?: PaletteOptions["primary"];
    keypadOperator?: PaletteOptions["primary"];
    keypadFunction?: PaletteOptions["primary"];
    keypadUtility?: PaletteOptions["primary"];
  }
  interface TypeBackground {
    keypad: string;
  }
  interface TypographyVariants {
    display: CSSProperties;
    displayError: CSSProperties;
    pendingLine: CSSProperties;
    historyExpression: CSSProperties;
    historyResult: CSSProperties;
  }
  interface TypographyVariantsOptions {
    display?: CSSProperties;
    displayError?: CSSProperties;
    pendingLine?: CSSProperties;
    historyExpression?: CSSProperties;
    historyResult?: CSSProperties;
  }
}

declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    keypadNumber: true;
    keypadOperator: true;
    keypadFunction: true;
    keypadUtility: true;
  }
  interface ButtonPropsSizeOverrides {
    keypad: true;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    display: true;
    displayError: true;
    pendingLine: true;
    historyExpression: true;
    historyResult: true;
  }
}

const MONO_FONT = '"Roboto Mono", ui-monospace, monospace';
const PRIMARY_TEXT = "rgba(0, 0, 0, 0.87)";
const OUTLINE = "rgba(0, 0, 0, 0.23)";

const keyColor = (main: string, hover: string, text: string) => ({
  main,
  light: main,
  dark: hover,
  contrastText: text,
});

const baseTheme = createTheme({
  palette: {
    background: { default: "#f5f5f5", keypad: "#fafafa" },
    keypadNumber: keyColor("#fff", "#f5f5f5", PRIMARY_TEXT),
    keypadOperator: keyColor("#e3f2fd", "#bbdefb", "#0d47a1"),
    keypadFunction: keyColor("#f3e5f5", "#e1bee7", "#6a1b9a"),
    keypadUtility: keyColor("#f5f5f5", "#eeeeee", PRIMARY_TEXT),
  },
  shape: { borderRadius: 4 },
});

const monoBlock = (fontSize: number, color: string): CSSProperties => ({
  display: "block",
  fontFamily: MONO_FONT,
  fontSize,
  fontWeight: 400,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
  color,
});

const { palette } = baseTheme;

export const theme = createTheme(baseTheme, {
  typography: {
    subtitle1: { fontWeight: 500 },
    display: monoBlock(48, palette.text.primary),
    displayError: monoBlock(24, palette.error.main),
    pendingLine: { ...monoBlock(14, palette.text.secondary), minHeight: 20 },
    historyExpression: monoBlock(14, palette.text.secondary),
    historyResult: { ...monoBlock(20, palette.text.primary), fontWeight: 500 },
  },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 2 },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          display: "span",
          displayError: "span",
          pendingLine: "span",
          historyExpression: "span",
          historyResult: "span",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          variants: [
            {
              props: { size: "keypad" },
              style: {
                minWidth: 0,
                fontSize: 20,
                fontWeight: 500,
                textTransform: "none",
              },
            },
            {
              props: { size: "keypad", color: "keypadNumber" },
              style: { border: `1px solid ${OUTLINE}` },
            },
            {
              props: { size: "keypad", color: "error", variant: "outlined" },
              style: { backgroundColor: palette.common.white },
            },
          ],
        },
      },
    },
  },
});
