import { apiFetch } from "./client";
import type { Gap, GapAssignRequest, GapStatus } from "./types";

export function listGaps(status?: GapStatus): Promise<Gap[]> {
  return apiFetch<Gap[]>("/admin/gaps", { params: { status } });
}

export function assignGap(gapId: string, payload: GapAssignRequest): Promise<Gap> {
  return apiFetch<Gap>(`/admin/gaps/${gapId}/assign`, { method: "POST", body: payload });
}
