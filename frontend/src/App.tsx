import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import AppBar from "@mui/material/AppBar";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useEffect, useRef, useState } from "react";
import { historyPaperSx, mainSx, titleSx } from "./App.sx";
import CalculatorPanel from "./components/CalculatorPanel/CalculatorPanel";
import HistoryPanel from "./components/HistoryPanel/HistoryPanel";
import { useCalculator } from "./hooks/useCalculator";

export default function App() {
  const calculator = useCalculator();
  const isMobile = useMediaQuery(useTheme().breakpoints.down("md"), {
    noSsr: true,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = () => panelRef.current?.focus();

  useEffect(() => {
    if (!calculator.loading) panelRef.current?.focus();
  }, [calculator.loading]);

  const history = (
    <HistoryPanel
      history={calculator.history}
      disabled={calculator.loading}
      onReuse={(result) => {
        calculator.reuse(result);
        setDrawerOpen(false);
        focusPanel();
      }}
      onClear={() => {
        calculator.clearHistory();
        focusPanel();
      }}
    />
  );

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography component="h1" variant="h6" sx={titleSx}>
            Calculator
          </Typography>
          {isMobile && (
            <IconButton
              size="large"
              color="inherit"
              edge="end"
              aria-label="Open history"
              onClick={() => setDrawerOpen(true)}
            >
              <HistoryIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth={false} sx={mainSx}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          gap={3}
          alignItems="flex-start"
        >
          <CalculatorPanel
            onPress={calculator.press}
            loading={calculator.loading}
            display={calculator.display}
            panelRef={panelRef}
          />
          {!isMobile && (
            <Paper elevation={2} sx={historyPaperSx}>
              {history}
            </Paper>
          )}
        </Stack>
      </Container>

      {isMobile && (
        <Drawer
          anchor="bottom"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          disableRestoreFocus
          slotProps={{ transition: { onExited: focusPanel } }}
        >
          {history}
        </Drawer>
      )}

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
