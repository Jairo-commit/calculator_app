import Box from "@mui/material/Box";
import Button, { type ButtonProps } from "@mui/material/Button";
import { KEYPAD, type KeyId, type KeyKind } from "../../lib/calculator";
import { keySx, keypadSx } from "./Keypad.sx";

const KEY_APPEARANCE: Record<
  KeyKind,
  Required<Pick<ButtonProps, "color" | "variant">>
> = {
  num: { color: "keypadNumber", variant: "contained" },
  op: { color: "keypadOperator", variant: "contained" },
  fn: { color: "keypadFunction", variant: "contained" },
  util: { color: "keypadUtility", variant: "contained" },
  clear: { color: "error", variant: "outlined" },
  equals: { color: "primary", variant: "contained" },
};

interface KeypadProps {
  loading: boolean;
  onPress: (id: KeyId) => void;
}

export default function Keypad({ loading, onPress }: KeypadProps) {
  return (
    <Box sx={keypadSx}>
      {KEYPAD.map((keyDef) => {
        const { id, label, kind, aria } = keyDef;
        const waiting = kind === "equals" && loading;
        return (
          <Button
            key={id}
            size="keypad"
            {...KEY_APPEARANCE[kind]}
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
