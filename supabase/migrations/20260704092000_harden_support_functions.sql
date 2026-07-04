-- Harden the live-chat SECURITY DEFINER functions (advisor: anon/authenticated could
-- call them via /rest/v1/rpc). The trigger function needs no caller EXECUTE at all;
-- is_egs_admin() must stay executable by `authenticated` because the realtime.messages
-- RLS policy evaluates it as the subscribing user.

revoke execute on function public.egs_support_broadcast() from public, anon, authenticated;

revoke execute on function public.is_egs_admin() from public, anon, authenticated;
grant execute on function public.is_egs_admin() to authenticated;
