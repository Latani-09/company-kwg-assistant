import { apiFetch } from "./client";
import type { QAEntry, QAEntryCreate } from "./types";

export function listEntries(sectorId: string): Promise<QAEntry[]> {
  return apiFetch<QAEntry[]>("/knowledge/qa", { params: { sector: sectorId } });
}

export function createEntry(payload: QAEntryCreate): Promise<QAEntry> {
  return apiFetch<QAEntry>("/knowledge/qa", { method: "POST", body: payload });
}

export function deleteEntry(entryId: string): Promise<void> {
  return apiFetch<void>(`/knowledge/qa/${entryId}`, { method: "DELETE" });
}
