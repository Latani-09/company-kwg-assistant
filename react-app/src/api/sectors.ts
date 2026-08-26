import { apiFetch } from "./client";
import type { Sector } from "./types";

export function listSectors(): Promise<Sector[]> {
  return apiFetch<Sector[]>("/sectors");
}
