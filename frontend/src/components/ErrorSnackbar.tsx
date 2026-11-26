import CloseIcon from "@mui/icons-material/Close";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

interface ErrorSnackbarProps {
  open: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Server-side problems only; anything the user can fix shows on the field. */
export default function ErrorSnackbar({
  open,
  onRetry,
  onDismiss,
}: ErrorSnackbarProps) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  return (
    <Snackbar
      open={open}
      anchorOrigin={{
        vertical: isPhone ? "top" : "bottom",
        horizontal: "center",
      }}
      message="Couldn't reach the server. Your input is kept."
      action={
        <>
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
          <IconButton
            color="inherit"
            size="small"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      }
    />
  );
}
