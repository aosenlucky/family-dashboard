-- Additive installation. No family rows, diaries or existing cron jobs are changed.
-- Reminder delivery state is independent of family ZIP backup / restore.
create table if not exists public.family_coupon_reminder_state (
  id text primary key check (id = 'main'),
  version bigint not null default 0 check (version >= 0),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.family_coupon_reminder_state enable row level security;
revoke all on public.family_coupon_reminder_state from public, anon, authenticated;
grant select, insert, update on public.family_coupon_reminder_state to service_role;

-- Runtime uses PATCH ... WHERE version=<read version> RETURNING ... to atomically
-- claim batches, deduplicate event keys and persist nonces across server instances.
-- A lost send lease becomes UNKNOWN; it is never blindly resent.

-- CRON ACTIVATION IS AN EXPLICIT SEPARATE STEP AFTER PREVIEW ACCEPTANCE.
-- Enable pg_cron, pg_net, pgcrypto and Vault in this existing project first.
-- Store these via the Supabase Vault UI (never paste actual values into Git):
--   family_coupon_cron_secret: >=32 random characters, identical to EdgeOne COUPON_CRON_SECRET
--   family_coupon_reminder_url: https://<personal-site>/api/coupon-reminder-run
-- Set the two named members' tokens in EdgeOne server env as needed:
--   COUPON_AOSEN_TOKEN / COUPON_XIAOYUE_TOKEN
-- Existing SERVERCHAN_KEY/PUSHPLUS_TOKEN is a single undifferentiated family channel fallback.
-- Optional final PushPlus status polling needs COUPON_PUSHPLUS_ACCESS_KEY or per-member
-- COUPON_AOSEN_PUSHPLUS_ACCESS_KEY / COUPON_XIAOYUE_PUSHPLUS_ACCESS_KEY.
--
-- Once both Vault secrets and the deployed endpoint have been checked, run this
-- commented block as postgres. It is intentionally NOT activated by this migration.
-- Every 30 minutes allows bounded compensation; code only sends after 09:00 Asia/Shanghai
-- and respects quiet hours. One successful/uncertain digest per destination per day.
/*
select cron.schedule('family-coupon-reminders', '0,30 * * * *', $job$
do $body$
declare
  v_secret text;
  v_url text;
  v_ts text := floor(extract(epoch from clock_timestamp()))::bigint::text;
  v_nonce text := gen_random_uuid()::text;
  v_signature text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='family_coupon_cron_secret' limit 1;
  select decrypted_secret into v_url from vault.decrypted_secrets where name='family_coupon_reminder_url' limit 1;
  if v_secret is null or length(v_secret)<32 or v_url is null or v_url !~ '^https://[^/]+/api/coupon-reminder-run$' then
    return;
  end if;
  v_signature := encode(extensions.hmac(v_ts || '.' || v_nonce || '.coupon-reminders-v1', v_secret, 'sha256'), 'hex');
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-coupon-timestamp',v_ts,'x-coupon-signature',v_signature),
    body := jsonb_build_object('job','coupon-reminders-v1','nonce',v_nonce),
    timeout_milliseconds := 10000
  );
end $body$;
$job$);
*/
-- After copying/restoring the database into another environment, keep its cron disabled;
-- rotate the dedicated secret on production receiver + Vault before enabling a new copy.
