export type UserRole = "user" | "superAdmin";
export type UserStatus = "pending" | "granted" | "revoked";
export type GapStatus = "open" | "assigned" | "resolved";

export interface Sector {
  id: string;
  key: string;
  label: string;
  is_custom: boolean;
}

export interface SignupSectorInput {
  key: string;
  label?: string;
}

export interface UserSignup {
  name: string;
  email: string;
  username: string;
  password: string;
  position: string;
  sectors: SignupSectorInput[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  position: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  sectors: Sector[];
}

export interface AdminUser extends User {
  granted: boolean;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface ResetPasswordRequest {
  user_id: string;
  username: string;
  token: string;
  new_password: string;
}

export interface QAEntry {
  id: string;
  sector_id: string;
  question: string;
  answer: string;
  source: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QAEntryCreate {
  sector_id: string;
  question: string;
  answer: string;
  source?: string | null;
  gap_id?: string | null;
}

export interface ChatSource {
  id: string;
  question: string;
  answer: string;
  source: string | null;
}

export interface ChatQueryResponse {
  answer: string | null;
  sources: ChatSource[];
  is_gap: boolean;
  confidence: number | null;
}

export interface Gap {
  id: string;
  source_query_id: string;
  question_text: string;
  asker_id: string;
  status: GapStatus;
  assigned_to_id: string | null;
  assigned_sector_id: string | null;
  created_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
}

export interface GapAssignRequest {
  assigned_to_id: string;
  assigned_sector_id: string;
}
