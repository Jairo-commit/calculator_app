import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { KeyboardEvent, RefObject } from "react";
import { keyIdFor, type KeyId } from "../lib/calculator";
import type { Display } from "../lib/calculatorState";
import { MONO_FONT } from "../theme";
import Keypad from "./Keypad";

interface CalculatorPanelProps {
  onPress: (id: KeyId) => void;
  loading: boolean;
  display: Display;
  /** The focusable panel; it receives the physical keyboard. */
  panelRef: RefObject<HTMLDivElement | null>;
}

export default function CalculatorPanel({
  onPress,
  loading,
  display,
  panelRef,
}: CalculatorPanelProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const id = keyIdFor(event.key);
    if (id === null) return;
    // Needed in real browsers to stop Enter clicking the focused key too; jsdom cannot prove it.
    event.preventDefault();
    onPress(id);
  };

  return (
    <Paper
      ref={panelRef}
      role="group"
      aria-label="Calculator"
      tabIndex={0}
      onKeyDown={onKeyDown}
      elevation={2}
      sx={{
        flex: { md: "1 1 420px" },
        maxWidth: { md: 560 },
        minWidth: 0,
        overflow: "hidden",
        outline: "none",
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: -2,
        },
      }}
    >
      <Box
        component="output"
        aria-live="polite"
        sx={{
          display: "block",
          p: 3,
          textAlign: "right",
          fontFamily: MONO_FONT,
        }}
      >
        <Typography
          component="span"
          data-testid="pending"
          sx={{
            display: "block",
            minHeight: 20,
            fontFamily: "inherit",
            fontSize: 14,
            color: "text.secondary",
          }}
        >
          {display.pending}
        </Typography>
        <Typography
          component="span"
          data-testid="value"
          sx={{
            display: "block",
            minHeight: 56,
            fontFamily: "inherit",
            fontSize: display.isError ? 24 : 48,
            overflowWrap: "anywhere",
            color: display.isError ? "error.main" : "text.primary",
          }}
        >
          {display.value}
        </Typography>
      </Box>
      <Box sx={{ height: 4 }}>
        {loading && <LinearProgress aria-label="Calculating" />}
      </Box>
      <Keypad loading={loading} onPress={onPress} />
    </Paper>
  );
}
