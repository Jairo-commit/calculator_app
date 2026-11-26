export interface HistoryEntry {
  expr: string;
  result: number;
}

export const HISTORY_LIMIT = 8;
export const HISTORY_KEY = "calculator.history.v1";

/** Reads saved history; unreadable storage yields []. */
export function loadHistory(): HistoryEntry[] {
  try {
    const saved: HistoryEntry[] = JSON.parse(
      localStorage.getItem(HISTORY_KEY) ?? "[]",
    );
    return saved
      .filter((e) => typeof e.expr === "string" && Number.isFinite(e.result))
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

/** Best-effort: history still works for the session if storage is unavailable. */
export function saveHistory(entries: readonly HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // ignored
  }
}
