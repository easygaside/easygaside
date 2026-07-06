-- P0-1 (v2 audit 2026-07-07): egs_strip_reasoning is SECURITY DEFINER and mutates
-- egs_messages by project_id with NO owner check. A create-or-replace after migration
-- 20260628140000 restored PUBLIC EXECUTE, so anon + authenticated could call it
-- cross-tenant (verified live via has_function_privilege) — a cross-tenant history
-- mutation that also poisons deepseek-pro projects (which require reasoning_content).
-- Lock it to service_role only: the sole caller is repointProjectModelAction via the
-- service-role client. Revoking from PUBLIC too keeps a future create-or-replace from
-- silently re-granting.
revoke execute on function public.egs_strip_reasoning(uuid) from public, anon, authenticated;
grant execute on function public.egs_strip_reasoning(uuid) to service_role;
