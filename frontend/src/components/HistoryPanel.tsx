import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Typography from "@mui/material/Typography";
import { formatResult } from "../lib/calculator";
import type { HistoryEntry } from "../lib/history";
import { MONO_FONT } from "../theme";

interface HistoryPanelProps {
  history: readonly HistoryEntry[];
  disabled: boolean;
  onReuse: (result: number) => void;
  onClear: () => void;
}

const mono = { display: "block", fontFamily: MONO_FONT } as const;

export default function HistoryPanel({
  history,
  disabled,
  onReuse,
  onClear,
}: HistoryPanelProps) {
  return (
    <Box component="section" aria-labelledby="history-heading">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1,
        }}
      >
        <Typography
          id="history-heading"
          component="h2"
          sx={{ fontSize: 16, fontWeight: 500 }}
        >
          History
        </Typography>
        <Button disabled={history.length === 0} onClick={onClear}>
          Clear
        </Button>
      </Box>
      <Divider />
      {history.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 5, textAlign: "center" }}>
          No calculations yet. Results you calculate will show up here.
        </Typography>
      ) : (
        <List disablePadding>
          {history.map(({ expr, result }, index) => (
            <ListItemButton
              key={`${index}-${expr}`}
              disabled={disabled}
              aria-label={`Reuse ${expr} = ${formatResult(result)}`}
              onClick={() => onReuse(result)}
              sx={{ minHeight: 44, display: "block", textAlign: "right" }}
            >
              <Typography
                component="span"
                sx={{ ...mono, fontSize: 14, color: "text.secondary" }}
              >
                {expr} =
              </Typography>
              <Typography
                component="span"
                sx={{ ...mono, fontSize: 20, fontWeight: 500 }}
              >
                {formatResult(result)}
              </Typography>
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
