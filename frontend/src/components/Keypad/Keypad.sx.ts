import type { SxProps, Theme } from "@mui/material/styles";
import type { KeyDef, KeyKind } from "../../lib/calculator";

interface KeyColors {
  background: string;
  color: string;
  hoverBackground: string;
  border?: string;
}

export const KEY_COLORS: Record<Exclude<KeyKind, "equals">, KeyColors> = {
  num: {
    background: "#fff",
    color: "text.primary",
    hoverBackground: "#f5f5f5",
    border: "rgba(0,0,0,0.23)",
  },
  op: { background: "#e3f2fd", color: "#0d47a1", hoverBackground: "#bbdefb" },
  fn: { background: "#f3e5f5", color: "#6a1b9a", hoverBackground: "#e1bee7" },
  util: {
    background: "#f5f5f5",
    color: "text.primary",
    hoverBackground: "#eeeeee",
  },
  clear: {
    background: "#fff",
    color: "error.main",
    hoverBackground: "rgba(211,47,47,0.04)",
    border: "rgba(211,47,47,0.5)",
  },
};

export const keypadSx: SxProps<Theme> = {
  bgcolor: "#fafafa",
  p: { xs: "16px", sm: "20px 24px 24px" },
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: { xs: "10px", sm: "12px" },
};

export const keySx = ({
  kind,
  wide,
  tall,
}: Pick<KeyDef, "kind" | "wide" | "tall">): SxProps<Theme> => {
  const colors = kind === "equals" ? undefined : KEY_COLORS[kind];
  return {
    height: tall ? "auto" : { xs: 64, sm: 56 },
    minWidth: 0,
    fontSize: 20,
    fontWeight: 500,
    textTransform: "none",
    gridColumn: wide ? "span 2" : undefined,
    gridRow: tall ? "span 2" : undefined,
    ...(colors && {
      bgcolor: colors.background,
      color: colors.color,
      borderColor: colors.border,
      "&:hover": {
        bgcolor: colors.hoverBackground,
        borderColor: colors.border,
      },
    }),
  };
};
