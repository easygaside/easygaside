/**
 * Hand-written row types for the easygas schema (matches supabase/migrations/*).
 * Once a live Supabase project exists, replace with `supabase gen types typescript`.
 */

export type ProjectKind = "webapp" | "bound";
export type ProjectStatus = "draft" | "previewing" | "deployed" | "archived";
/** Deployment runtime. Only 'gas' is implemented; web targets are designed in docs/WEB-TARGET.md. */
export type TargetId = "gas" | "web-supabase" | "static-web";

export interface EgsProject {
  id: string;
  owner_id: string;
  name: string;
  kind: ProjectKind;
  target: TargetId;
  spec: Record<string, unknown> | null;
  script_id: string | null;
  bound_sheet_id: string | null;
  scratch_script_id: string | null;
  token_spend_input: number;
  token_spend_output: number;
  created_at: string;
  updated_at: string;
}

export interface EgsFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  content_hash: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant";
export type TurnType = "codegen" | "plan";

export interface EgsMessage {
  id: string;
  project_id: string;
  role: MessageRole;
  content: unknown; // Anthropic content blocks (jsonb)
  turn_type: TurnType;
  created_at: string;
}

export interface EgsChatImage {
  id: string;
  project_id: string;
  storage_path: string;
  media_type: string;
  bytes: number | null;
  created_at: string;
}

export type DeploymentEntryType = "webapp" | "api_executable";

export interface EgsDeployment {
  id: string;
  project_id: string;
  deployment_id: string;
  entry_type: DeploymentEntryType;
  exec_url: string | null;
  version_number: number | null;
  created_at: string;
  updated_at: string;
}

export type ConnectionStatus = "active" | "needs_reauth" | "revoked";

export interface GoogleConnection {
  user_id: string;
  google_sub: string;
  scope: string;
  refresh_token_enc: string;
  refresh_token_iv: string;
  refresh_token_tag: string;
  access_token_expires_at: string | null;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}
