export interface HistoryEntry {
  expr: string;
  result: number;
}

export const HISTORY_LIMIT = 8;
export const HISTORY_KEY = "calculator.history.v1";

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const { expr, result } = value as Record<string, unknown>;
  return (
    typeof expr === "string" &&
    typeof result === "number" &&
    Number.isFinite(result)
  );
}

/** Reads saved history; corrupt data or unavailable storage yields []. */
export function loadHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(HISTORY_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter(isEntry).slice(0, HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

/** Saves history; storage being unavailable or full is not an error for the user. */
export function saveHistory(entries: readonly HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Persistence is best-effort; history still works for this session.
  }
}

/** Returns a new list with the entry first, capped at HISTORY_LIMIT. */
export function addEntry(
  list: readonly HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  return [entry, ...list].slice(0, HISTORY_LIMIT);
}
