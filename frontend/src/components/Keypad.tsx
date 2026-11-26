import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { KEYPAD, type KeyId, type KeyKind } from "../lib/calculator";

const COLORS: Record<
  Exclude<KeyKind, "equals">,
  { bg: string; color: string; hover: string; border?: string }
> = {
  num: {
    bg: "#fff",
    color: "text.primary",
    hover: "#f5f5f5",
    border: "rgba(0,0,0,0.23)",
  },
  op: { bg: "#e3f2fd", color: "#0d47a1", hover: "#bbdefb" },
  fn: { bg: "#f3e5f5", color: "#6a1b9a", hover: "#e1bee7" },
  util: { bg: "#f5f5f5", color: "text.primary", hover: "#eeeeee" },
  clear: {
    bg: "#fff",
    color: "error.main",
    hover: "rgba(211,47,47,0.04)",
    border: "rgba(211,47,47,0.5)",
  },
};

interface KeypadProps {
  loading: boolean;
  onPress: (id: KeyId) => void;
}

export default function Keypad({ loading, onPress }: KeypadProps) {
  return (
    <Box
      sx={{
        bgcolor: "#fafafa",
        p: { xs: "16px", sm: "20px 24px 24px" },
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: { xs: "10px", sm: "12px" },
      }}
    >
      {KEYPAD.map(({ id, label, kind, aria, wide, tall }) => {
        const colors = kind === "equals" ? undefined : COLORS[kind];
        const waiting = kind === "equals" && loading;
        return (
          <Button
            key={id}
            variant={colors?.border ? "outlined" : "contained"}
            disableElevation={kind !== "equals"}
            disabled={waiting}
            aria-label={aria}
            onClick={() => onPress(id)}
            sx={{
              height: tall ? "auto" : { xs: 64, sm: 56 },
              minWidth: 0,
              fontSize: 20,
              fontWeight: 500,
              textTransform: "none",
              gridColumn: wide ? "span 2" : undefined,
              gridRow: tall ? "span 2" : undefined,
              ...(colors && {
                bgcolor: colors.bg,
                color: colors.color,
                borderColor: colors.border,
                "&:hover": {
                  bgcolor: colors.hover,
                  borderColor: colors.border,
                },
              }),
            }}
          >
            {waiting ? "Calculating…" : label}
          </Button>
        );
      })}
    </Box>
  );
}
