export interface HistoryEntry {
  expr: string;
  result: number;
}

export const HISTORY_LIMIT = 8;
export const HISTORY_KEY = "calculator.history.v1";

export function loadHistory(): HistoryEntry[] {
  try {
    const saved: HistoryEntry[] = JSON.parse(
      localStorage.getItem(HISTORY_KEY) ?? "[]",
    );
    return saved
      .filter(
        (entry) =>
          typeof entry.expr === "string" && Number.isFinite(entry.result),
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveHistory(entries: readonly HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    return;
  }
}
