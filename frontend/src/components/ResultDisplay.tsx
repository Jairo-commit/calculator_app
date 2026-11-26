import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { MONO_FONT } from "../theme";
import type { Display } from "../hooks/useCalculator";

type ResultDisplayProps = Display;

/** Right-aligned result/preview block, announced politely to screen readers. */
export default function ResultDisplay({
  label,
  value,
  tone,
}: ResultDisplayProps) {
  return (
    <Box
      component="output"
      htmlFor="expression"
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
        sx={{
          display: "block",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.4px",
          color: "text.secondary",
        }}
      >
        {label}
      </Typography>
      <Typography
        component="span"
        variant="h3"
        sx={{
          display: "block",
          fontFamily: MONO_FONT,
          fontSize: 48,
          lineHeight: 1.167,
          whiteSpace: "nowrap",
          overflowX: "auto",
          color: tone === "primary" ? "text.primary" : "text.disabled",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
