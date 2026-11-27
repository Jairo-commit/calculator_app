import type { SxProps, Theme } from "@mui/material/styles";

export const panelSx: SxProps<Theme> = (theme) => ({
  overflow: "hidden",
  outline: "none",
  "&:focus-visible": {
    outline: "2px solid",
    outlineColor: theme.palette.primary.main,
    outlineOffset: -2,
  },
});

const MONO_CHARACTER_WIDTH_EM = 0.6;

export const outputSx: SxProps<Theme> = {
  display: "block",
  p: 3,
  textAlign: "right",
  containerType: "inline-size",
};

export const errorValueSx: SxProps<Theme> = { minHeight: 56 };

export const fittedValueSx = (characterCount: number) => (theme: Theme) => {
  const { fontSize } = theme.typography.display;
  const largestFontSize =
    typeof fontSize === "number" ? `${fontSize}px` : fontSize;
  const fittingFontSize = `calc(100cqi / ${characterCount} / ${MONO_CHARACTER_WIDTH_EM})`;
  return {
    minHeight: 56,
    fontSize: `min(${largestFontSize}, ${fittingFontSize})`,
  };
};

export const progressSlotSx: SxProps<Theme> = { height: 4 };
