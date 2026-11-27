import Box from "@mui/material/Box";
import Button, { type ButtonProps } from "@mui/material/Button";
import { KEYPAD } from "../../lib/keys";
import type { KeyId, KeyKind } from "../../models/key";
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
  disabled: boolean;
  onPress: (id: KeyId) => void;
}

export default function Keypad({ disabled, onPress }: KeypadProps) {
  return (
    <Box sx={keypadSx}>
      {KEYPAD.map((keyDef) => {
        const { id, label, kind, aria } = keyDef;
        return (
          <Button
            key={id}
            size="keypad"
            {...KEY_APPEARANCE[kind]}
            disableElevation={kind !== "equals"}
            disabled={disabled}
            aria-label={aria}
            onClick={() => onPress(id)}
            sx={keySx(keyDef)}
          >
            {label}
          </Button>
        );
      })}
    </Box>
  );
}
