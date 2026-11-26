import HistoryIcon from "@mui/icons-material/History";
import AppBar from "@mui/material/AppBar";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useRef, useState } from "react";
import CalculatorPanel from "./components/CalculatorPanel";
import ErrorSnackbar from "./components/ErrorSnackbar";
import HistoryPanel from "./components/HistoryPanel";
import { useCalculator } from "./hooks/useCalculator";
import type { HistoryEntry } from "./lib/history";

export default function App() {
  const calc = useCalculator();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"), {
    noSsr: true,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The drawer restores focus to its trigger when it closes, so after a reuse
  // the input is focused only once the drawer has finished closing.
  const focusInputOnDrawerExit = useRef(false);

  const handleReuse = (entry: HistoryEntry) => {
    calc.reuse(entry);
    if (isMobile) {
      focusInputOnDrawerExit.current = true;
      setDrawerOpen(false);
    } else {
      inputRef.current?.focus();
    }
  };

  const history = (
    <HistoryPanel
      history={calc.history}
      onReuse={handleReuse}
      onClear={calc.clearHistory}
    />
  );

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography component="h1" variant="h6" sx={{ flexGrow: 1 }}>
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

      <Container
        component="main"
        maxWidth={false}
        sx={{
          maxWidth: 1040,
          py: { xs: 2, md: 5 },
          display: { xs: "flex", sm: "block" },
          flexDirection: "column",
          minHeight: { xs: "calc(100dvh - 56px)", sm: "auto" },
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          gap={3}
          alignItems={{ xs: "stretch", md: "flex-start" }}
          sx={{ flex: { xs: 1, sm: "initial" } }}
        >
          <CalculatorPanel
            expr={calc.expr}
            onExprChange={calc.setExpr}
            onKeyPress={calc.press}
            onCalculate={() => void calc.calculate()}
            onClear={calc.clear}
            loading={calc.loading}
            fieldError={calc.fieldError}
            display={calc.display}
            inputRef={inputRef}
          />
          {!isMobile && (
            <Paper elevation={2} sx={{ flex: "1 1 300px", minWidth: 0 }}>
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
          slotProps={{
            paper: {
              sx: {
                maxHeight: "70dvh",
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
              },
            },
            transition: {
              onExited: () => {
                if (focusInputOnDrawerExit.current) {
                  focusInputOnDrawerExit.current = false;
                  inputRef.current?.focus();
                }
              },
            },
          }}
        >
          {history}
        </Drawer>
      )}

      <ErrorSnackbar
        open={calc.serverErrorOpen}
        onRetry={() => void calc.retry()}
        onDismiss={calc.dismissServerError}
      />
    </>
  );
}
