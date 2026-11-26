import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import type { KeyboardEvent, Ref } from "react";
import type { Display } from "../hooks/useCalculator";
import type { KeyDef } from "../lib/calculator";
import { MONO_FONT } from "../theme";
import Keypad from "./Keypad";
import ResultDisplay from "./ResultDisplay";

const DEFAULT_HELPER =
  "Enter to calculate · Esc to clear · % divides by 100 (80 × 15% = 12)";

interface CalculatorPanelProps {
  expr: string;
  onExprChange: (value: string) => void;
  onKeyPress: (key: KeyDef) => void;
  onCalculate: () => void;
  onClear: () => void;
  loading: boolean;
  fieldError: string | null;
  display: Display;
  inputRef: Ref<HTMLInputElement>;
}

export default function CalculatorPanel({
  expr,
  onExprChange,
  onKeyPress,
  onCalculate,
  onClear,
  loading,
  fieldError,
  display,
  inputRef,
}: CalculatorPanelProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCalculate();
    } else if (event.key === "Escape") {
      onClear();
    }
  };

  return (
    <Paper
      elevation={2}
      sx={{
        flex: { xs: 1, sm: "0 0 auto", md: "1 1 420px" },
        maxWidth: { md: 560 },
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          p: 3,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: { xs: "flex-end", sm: "flex-start" },
          gap: 2,
        }}
      >
        <TextField
          id="expression"
          label="Expression"
          placeholder="e.g. (12 + 8) × 3"
          fullWidth
          value={expr}
          onChange={(event) => onExprChange(event.target.value)}
          error={!!fieldError}
          helperText={fieldError ?? DEFAULT_HELPER}
          inputRef={inputRef}
          slotProps={{
            htmlInput: {
              inputMode: "decimal",
              autoComplete: "off",
              spellCheck: false,
              onKeyDown: handleKeyDown,
            },
            input: { sx: { fontFamily: MONO_FONT, fontSize: 20 } },
          }}
        />
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
