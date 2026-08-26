import { apiFetch } from "./client";
import type { ChatQueryResponse } from "./types";

export function askQuestion(question: string): Promise<ChatQueryResponse> {
  return apiFetch<ChatQueryResponse>("/chat/query", { method: "POST", body: { question } });
}
