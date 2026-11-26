import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";
import type { KeyDef, KeyKind } from "../lib/calculator";
import { keyColors } from "../theme";

const StyledButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "keyKind",
})<{ keyKind: KeyKind }>(({ keyKind }) => {
  const colors = keyColors[keyKind];
  const outlined = keyKind === "num" || keyKind === "clear";
  if (keyKind === "equals") return {};
  return {
    color: colors.text,
    backgroundColor: colors.bg,
    ...(outlined && { borderColor: colors.border }),
    "&:hover": {
      backgroundColor: colors.hover,
      ...(outlined && { borderColor: colors.border }),
    },
  };
});

interface KeypadButtonProps {
  keyDef: KeyDef;
  /** True while a calculation is in flight; only "=" reacts to it. */
  loading: boolean;
  onPress: (key: KeyDef) => void;
}

export default function KeypadButton({
  keyDef,
  loading,
  onPress,
}: KeypadButtonProps) {
  const isEquals = keyDef.kind === "equals";
  const outlined = keyDef.kind === "num" || keyDef.kind === "clear";

  return (
    <StyledButton
      keyKind={keyDef.kind}
      variant={outlined ? "outlined" : "contained"}
      color="primary"
      disableElevation={!isEquals}
      disabled={isEquals && loading}
      aria-label={keyDef.ariaLabel}
      onClick={() => onPress(keyDef)}
      sx={{
        height: { xs: 64, sm: 56 },
        minWidth: 0,
        fontSize: 20,
        fontWeight: 500,
        textTransform: "none",
        ...(keyDef.span === 2 && { gridColumn: "span 2" }),
      }}
    >
      {isEquals && loading ? "Calculating…" : keyDef.label}
    </StyledButton>
  );
}
