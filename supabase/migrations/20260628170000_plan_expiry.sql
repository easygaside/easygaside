-- Paid-plan expiry. Set to now()+30d on approval/extend (lib + app/admin/actions). getUserPlan
-- treats a user as 'free' once past plan_expires_at (read-time auto-downgrade, no background job).

alter table public.egs_user_settings add column if not exists plan_expires_at timestamptz;

comment on column public.egs_user_settings.plan_expires_at is
  'When the paid plan lapses. Set to now()+30d on approval/extend; getUserPlan treats the user as free once past it (read-time auto-downgrade). NULL on the free tier.';
