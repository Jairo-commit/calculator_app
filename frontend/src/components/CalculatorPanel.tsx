import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import { useEffect, type KeyboardEvent, type RefObject } from "react";
import type { Display } from "../hooks/useCalculator";
import { keyIdForPhysicalKey, type KeyId } from "../lib/calculator";
import Keypad from "./Keypad";
import ResultDisplay from "./ResultDisplay";

interface CalculatorPanelProps {
  onKeyPress: (id: KeyId) => void;
  loading: boolean;
  display: Display;
  /** The focusable calculator; it receives the physical keyboard. */
  panelRef: RefObject<HTMLDivElement | null>;
}

export default function CalculatorPanel({
  onKeyPress,
  loading,
  display,
  panelRef,
}: CalculatorPanelProps) {
  useEffect(() => panelRef.current?.focus(), [panelRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Enter on a focused key already clicks it; handling it too would press twice.
    if (event.key === "Enter" && event.target instanceof HTMLButtonElement) {
      return;
    }
    const id = keyIdForPhysicalKey(event.key);
    if (id === null) return;
    event.preventDefault();
    onKeyPress(id);
  };

  return (
    <Paper
      ref={panelRef}
      role="group"
      aria-label="Calculator"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      elevation={2}
      sx={{
        flex: { xs: 1, sm: "0 0 auto", md: "1 1 420px" },
        maxWidth: { md: 560 },
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        outline: "none",
      }}
    >
      <Box
        sx={{
          p: 3,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: { xs: "flex-end", sm: "flex-start" },
        }}
      >
        <ResultDisplay {...display} />
      </Box>
      {loading ? (
        <LinearProgress aria-label="Calculating" sx={{ height: 4 }} />
      ) : (
        <Box sx={{ height: 4 }} />
      )}
      <Keypad loading={loading} onPress={onKeyPress} />
    </Paper>
  );
}
