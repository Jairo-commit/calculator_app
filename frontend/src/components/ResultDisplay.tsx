import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Display } from "../hooks/useCalculator";
import { MONO_FONT } from "../theme";

/** Right-aligned pending line and value, announced politely to screen readers. */
export default function ResultDisplay({ pending, value, isError }: Display) {
  return (
    <Box
      component="output"
      aria-live="polite"
      sx={{
        display: "block",
        textAlign: "right",
        minHeight: 76,
        minWidth: 0,
      }}
    >
      <Typography
        component="span"
        data-testid="pending"
        sx={{
          display: "block",
          minHeight: 20,
          fontFamily: MONO_FONT,
          fontSize: 14,
          color: "text.secondary",
        }}
      >
        {pending}
      </Typography>
      <Typography
        component="span"
        variant="h3"
        tabIndex={0}
        role="region"
        aria-label="Result value"
        sx={{
          display: "block",
          fontFamily: MONO_FONT,
          fontSize: isError ? 24 : 48,
          lineHeight: isError ? 2.333 : 1.167,
          whiteSpace: isError ? "normal" : "nowrap",
          overflowX: "auto",
          color: isError ? "error.main" : "text.primary",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
