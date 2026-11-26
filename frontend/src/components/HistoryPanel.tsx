import AccessTimeIcon from "@mui/icons-material/AccessTime";
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
  onReuse: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export default function HistoryPanel({
  history,
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
        <Button
          disabled={history.length === 0}
          onClick={onClear}
          sx={{ minHeight: 44 }}
        >
          Clear
        </Button>
      </Box>
      <Divider />
      {history.length === 0 ? (
        <Box sx={{ p: 5, textAlign: "center" }}>
          <AccessTimeIcon
            aria-hidden
            sx={{ fontSize: 40, color: "text.disabled" }}
          />
          <Typography color="text.secondary">
            No calculations yet. Results you calculate will show up here.
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {history.map((entry, index) => {
            const result = formatResult(entry.result);
            return (
              <ListItemButton
                // The same expression can be calculated twice, so the index is part of the key.
                key={`${index}-${entry.expr}`}
                aria-label={`Reuse ${entry.expr} = ${result}`}
                onClick={() => onReuse(entry)}
                sx={{
                  minHeight: 44,
                  display: "block",
                  minWidth: 0,
                  textAlign: "right",
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    display: "block",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    fontFamily: MONO_FONT,
                    fontSize: 14,
                    color: "text.secondary",
                  }}
                >
                  {entry.expr} =
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    display: "block",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    fontFamily: MONO_FONT,
                    fontSize: 20,
                    fontWeight: 500,
                  }}
                >
                  {result}
                </Typography>
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
}
