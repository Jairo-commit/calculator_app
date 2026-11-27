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
  pendingLineSx,
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
      elevation={2}
      sx={panelSx}
    >
      <Box component="output" aria-live="polite" sx={outputSx}>
        <Typography component="span" data-testid="pending" sx={pendingLineSx}>
          {display.pending}
        </Typography>
        <Typography
          component="span"
          data-testid="value"
          sx={valueSx(display.isError)}
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
