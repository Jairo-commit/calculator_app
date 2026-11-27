import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { KeyboardEvent, RefObject } from "react";
import { keyIdFor, type KeyId } from "../../lib/calculator";
import type { Display } from "../../lib/calculatorState";
import Keypad from "../Keypad/Keypad";
import {
  outputSx,
  panelSx,
  progressSlotSx,
  valueSx,
} from "./CalculatorPanel.sx";

interface CalculatorPanelProps {
  onPress: (id: KeyId) => void;
  loading: boolean;
  display: Display;
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
      sx={panelSx}
    >
      <Box component="output" aria-live="polite" sx={outputSx}>
        <Typography variant="pendingLine" data-testid="pending">
          {display.pending}
        </Typography>
        <Typography
          variant={display.isError ? "displayError" : "display"}
          data-testid="value"
          sx={valueSx}
        >
          {display.value}
        </Typography>
      </Box>
      <Box sx={progressSlotSx}>
        {loading && <LinearProgress aria-label="Calculating" />}
      </Box>
      <Keypad loading={loading} onPress={onPress} />
    </Paper>
  );
}
