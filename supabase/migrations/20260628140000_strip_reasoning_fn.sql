-- Strip the DeepSeek thinking-model `reasoning_content` field from a project's stored message history.
-- Used when re-pointing a project off a reasoning arm (deepseek-pro) to a non-reasoning one (GLM/z.ai):
-- the OpenAI loop stores the full message object verbatim (incl. reasoning_content), and a non-reasoning
-- provider can 400 on it. SECURITY DEFINER + revoked from clients = callable only via service-role RPC.

create or replace function public.egs_strip_reasoning(p_project uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.egs_messages
  set content = content - 'reasoning_content'
  where project_id = p_project
    and jsonb_typeof(content) = 'object'
    and content ? 'reasoning_content';
$$;

revoke all on function public.egs_strip_reasoning(uuid) from anon, authenticated;
