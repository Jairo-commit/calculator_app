import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Typography from "@mui/material/Typography";
import { formatResult } from "../../lib/calculator";
import type { HistoryEntry } from "../../lib/history";
import {
  emptyMessageSx,
  entryExpressionSx,
  entryResultSx,
  entrySx,
  headerSx,
  headingSx,
} from "./HistoryPanel.sx";

interface HistoryPanelProps {
  history: readonly HistoryEntry[];
  disabled: boolean;
  onReuse: (result: number) => void;
  onClear: () => void;
}

export default function HistoryPanel({
  history,
  disabled,
  onReuse,
  onClear,
}: HistoryPanelProps) {
  return (
    <Box component="section" aria-labelledby="history-heading">
      <Box sx={headerSx}>
        <Typography id="history-heading" component="h2" sx={headingSx}>
          History
        </Typography>
        <Button disabled={history.length === 0} onClick={onClear}>
          Clear
        </Button>
      </Box>
      <Divider />
      {history.length === 0 ? (
        <Typography sx={emptyMessageSx}>
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
              sx={entrySx}
            >
              <Typography component="span" sx={entryExpressionSx}>
                {expr} =
              </Typography>
              <Typography component="span" sx={entryResultSx}>
                {formatResult(result)}
              </Typography>
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
