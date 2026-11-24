-- Private coupon screenshots and durable recognition quotas/cache.
-- Install in the existing personal family site's Supabase project.
-- Does not modify family records or encrypted diaries.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-coupons', 'family-coupons', false, 4194304, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 4194304,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

-- A broad existing photo policy must not accidentally expose this bucket.
-- Family PIN authentication stays on the server; no browser/anon policy grants access.
drop policy if exists family_coupon_server_only on storage.objects;
create policy family_coupon_server_only on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'family-coupons') with check (bucket_id <> 'family-coupons');

create table if not exists public.coupon_recognition_jobs (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('processing','completed','failed')),
  claim_id uuid not null,
  lease_until timestamptz not null,
  result jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.coupon_recognition_usage (
  period text primary key,
  image_count integer not null default 0 check (image_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.coupon_recognition_jobs enable row level security;
alter table public.coupon_recognition_usage enable row level security;
revoke all on public.coupon_recognition_jobs, public.coupon_recognition_usage from public, anon, authenticated;
grant select, insert, update, delete on public.coupon_recognition_jobs, public.coupon_recognition_usage to service_role;

create or replace function public.family_coupon_recognition_claim(
  p_key text, p_claim_id uuid, p_image_count integer, p_daily_limit integer, p_monthly_limit integer
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_job public.coupon_recognition_jobs%rowtype;
  v_day text := 'day:' || to_char(timezone('Asia/Shanghai', now()), 'YYYY-MM-DD');
  v_month text := 'month:' || to_char(timezone('Asia/Shanghai', now()), 'YYYY-MM');
  v_day_count integer;
  v_month_count integer;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_claim_id is null
    or p_image_count is null or p_image_count not between 1 and 3
    or p_daily_limit is null or p_daily_limit not between 1 and 1000
    or p_monthly_limit is null or p_monthly_limit not between 1 and 10000 then
    raise exception 'Invalid recognition claim';
  end if;
  -- One transaction admits a request and charges its quota. Concurrent requests
  -- can neither exceed the allowance nor call the model twice for the same key.
  perform pg_advisory_xact_lock(726300120);
  select * into v_job from public.coupon_recognition_jobs where cache_key = p_key;
  if found and v_job.status = 'completed' and v_job.result is not null then
    return jsonb_build_object('action','cached','result',v_job.result);
  end if;
  if v_job.status = 'processing' and v_job.lease_until > now() then
    return jsonb_build_object('action','busy');
  end if;
  insert into public.coupon_recognition_usage(period) values(v_day),(v_month) on conflict do nothing;
  select image_count into v_day_count from public.coupon_recognition_usage where period = v_day;
  select image_count into v_month_count from public.coupon_recognition_usage where period = v_month;
  if v_day_count + p_image_count > p_daily_limit or v_month_count + p_image_count > p_monthly_limit then
    return jsonb_build_object('action','limited');
  end if;
  update public.coupon_recognition_usage set image_count = image_count + p_image_count, updated_at = now()
    where period in (v_day, v_month);
  insert into public.coupon_recognition_jobs(cache_key,status,claim_id,lease_until)
    values(p_key,'processing',p_claim_id,now()+interval '2 minutes')
    on conflict(cache_key) do update set status='processing',claim_id=p_claim_id,
      lease_until=now()+interval '2 minutes',result=null,updated_at=now();
  return jsonb_build_object('action','claimed');
end;
$$;

create or replace function public.family_coupon_recognition_finish(
  p_key text, p_claim_id uuid, p_result jsonb, p_success boolean
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_claim_id is null or p_success is null then
    raise exception 'Invalid recognition result';
  end if;
  if p_success and (p_result is null or jsonb_typeof(p_result) <> 'object'
    or jsonb_typeof(p_result->'draft') is distinct from 'object' or octet_length(p_result::text) > 30000) then
    raise exception 'Invalid recognition payload';
  end if;
  update public.coupon_recognition_jobs
    set status = case when p_success then 'completed' else 'failed' end,
      result = case when p_success then p_result else null end, updated_at=now(),lease_until=now()
    where cache_key=p_key and claim_id=p_claim_id and status='processing';
  get diagnostics v_count = row_count;
  return jsonb_build_object('saved',v_count=1);
end;
$$;
revoke all on function public.family_coupon_recognition_claim(text,uuid,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.family_coupon_recognition_finish(text,uuid,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.family_coupon_recognition_claim(text,uuid,integer,integer,integer) to service_role;
grant execute on function public.family_coupon_recognition_finish(text,uuid,jsonb,boolean) to service_role;
commit;
