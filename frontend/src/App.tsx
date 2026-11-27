import CloseIcon from "@mui/icons-material/Close";
import AppBar from "@mui/material/AppBar";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import { useTheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useEffect, useRef } from "react";
import { mainSx } from "./App.sx";
import CalculatorPanel from "./components/CalculatorPanel/CalculatorPanel";
import { useCalculator } from "./hooks/useCalculator";

export default function App() {
  const calculator = useCalculator();
  const isMobile = useMediaQuery(useTheme().breakpoints.down("md"), {
    noSsr: true,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = () => panelRef.current?.focus();

  useEffect(() => {
    if (!calculator.loading) panelRef.current?.focus();
  }, [calculator.loading]);

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography component="h1" variant="h6">
            Calculator
          </Typography>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth={false} sx={mainSx}>
        <CalculatorPanel
          onPress={calculator.press}
          loading={calculator.loading}
          display={calculator.display}
          panelRef={panelRef}
        />
      </Container>

      <Snackbar
        open={calculator.snackbarOpen}
        anchorOrigin={{
          vertical: isMobile ? "top" : "bottom",
          horizontal: "center",
        }}
        message="Couldn't calculate right now. Your input is kept."
        action={
          <>
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                calculator.retry();
                focusPanel();
              }}
            >
              Retry
            </Button>
            <IconButton
              color="inherit"
              size="small"
              aria-label="Dismiss"
              onClick={() => {
                calculator.dismiss();
                focusPanel();
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      />
    </>
  );
}
