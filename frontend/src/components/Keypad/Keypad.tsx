import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { KEYPAD, type KeyId } from "../../lib/calculator";
import { KEY_COLORS, keySx, keypadSx } from "./Keypad.sx";

interface KeypadProps {
  loading: boolean;
  onPress: (id: KeyId) => void;
}

export default function Keypad({ loading, onPress }: KeypadProps) {
  return (
    <Box sx={keypadSx}>
      {KEYPAD.map((keyDef) => {
        const { id, label, kind, aria } = keyDef;
        const outlined = kind !== "equals" && Boolean(KEY_COLORS[kind].border);
        const waiting = kind === "equals" && loading;
        return (
          <Button
            key={id}
            variant={outlined ? "outlined" : "contained"}
            disableElevation={kind !== "equals"}
            disabled={waiting}
            aria-label={aria}
            onClick={() => onPress(id)}
            sx={keySx(keyDef)}
          >
            {waiting ? "Calculating…" : label}
          </Button>
        );
      })}
    </Box>
  );
}
