import Box from "@mui/material/Box";
import { KEYPAD, type KeyId } from "../lib/calculator";
import { tokens } from "../theme";
import KeypadButton from "./KeypadButton";

interface KeypadProps {
  loading: boolean;
  onPress: (id: KeyId) => void;
}

export default function Keypad({ loading, onPress }: KeypadProps) {
  return (
    <Box
      sx={{
        bgcolor: tokens.keypadBg,
        p: { xs: "16px", sm: "20px 24px 24px" },
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: { xs: "10px", sm: "12px" },
      }}
    >
      {KEYPAD.map((keyDef) => (
        <KeypadButton
          key={keyDef.id}
          keyDef={keyDef}
          loading={loading}
          onPress={onPress}
        />
      ))}
    </Box>
  );
}
