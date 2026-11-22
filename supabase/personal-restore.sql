-- Install once in the personal site's existing Supabase SQL editor before deployment.
-- Uses the existing tables; there is no destructive schema migration.
-- Only the server's service role may invoke this transaction.
create or replace function public.family_restore_snapshot(
  p_main_table text,
  p_index_table text,
  p_detail_table text,
  p_backup jsonb,
  p_revision bigint,
  p_point_id text,
  p_rollback_id text default null
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_main jsonb;
  v_target jsonb;
  v_travel jsonb;
  v_index jsonb;
  v_details jsonb;
  v_next jsonb;
  v_revision bigint;
  v_table_main text := format('public.%I', p_main_table);
  v_table_index text := format('public.%I', p_index_table);
  v_table_details text := format('public.%I', p_detail_table);
begin
  if p_revision is null or p_revision < 0 or p_point_id !~ '^restore-[a-f0-9-]{36}$' then
    raise exception 'Invalid restore request';
  end if;
  if p_rollback_id is not null and p_rollback_id !~ '^restore-[a-f0-9-]{36}$' then
    raise exception 'Invalid restore point';
  end if;
  -- Initial insertion and row lock serialize restores against ordinary main CAS updates.
  execute format('insert into %s (key,value,updated_at) values ($1,$2,now()) on conflict (key) do nothing', v_table_main)
    using 'main', '{}'::jsonb;
  execute format('select value from %s where key=$1 for update', v_table_main) into v_main using 'main';
  v_revision := coalesce((v_main->>'_familyRevision')::bigint, 0);
  if v_revision <> p_revision then
    return jsonb_build_object('conflict', true, 'current', v_main - 'llmApiKey' - 'wealthPassword');
  end if;
  -- Travel is legacy data. Lock both tables so a concurrent travel operation cannot
  -- interleave with the snapshot/delete/replace sequence.
  execute format('lock table %s, %s in share row exclusive mode', v_table_index, v_table_details);
  if p_rollback_id is not null then
    execute format('select value from %s where key=$1', v_table_main) into v_target using p_rollback_id;
  else
    v_target := p_backup;
  end if;
  if v_target is null or jsonb_typeof(v_target->'main') <> 'object' or jsonb_typeof(v_target->'travel') <> 'object' then
    raise exception 'Invalid or missing restore point';
  end if;
  execute format('select coalesce(jsonb_agg(summary order by saved_at desc),''[]''::jsonb) from %s', v_table_index) into v_index;
  execute format('select coalesce(jsonb_object_agg(id,item),''{}''::jsonb) from %s', v_table_details) into v_details;
  v_travel := jsonb_build_object('travelHistory', '[]'::jsonb, 'travelHistoryIndex', v_index, 'travelPlanDetails', v_details);
  execute format('insert into %s (key,value,updated_at) values ($1,$2,now())', v_table_main)
    using p_point_id, jsonb_build_object('version', 4, 'exportedAt', now(), 'main', v_main - '_familyRevision' - 'llmApiKey' - 'wealthPassword', 'travel', v_travel);
  v_next := (v_target->'main') - '_familyRevision' - 'llmApiKey' - 'wealthPassword';
  if v_main ? 'llmApiKey' then v_next := v_next || jsonb_build_object('llmApiKey', v_main->'llmApiKey'); end if;
  v_next := v_next || jsonb_build_object('_familyRevision', v_revision + 1);
  execute format('update %s set value=$1,updated_at=now() where key=$2', v_table_main) using v_next, 'main';
  execute format('delete from %s', v_table_details);
  execute format('delete from %s', v_table_index);
  execute format($q$
    insert into %s (id,destination,date_range,saved_at,active_variant,title,day_count,hotel_name,summary,updated_at)
    select item->>'id', coalesce(item->>'destination',''), coalesce(item->>'dateRange',''),
      coalesce(nullif(item->>'savedAt','')::timestamptz,now()),
      coalesce(item->>'activeVariant','classic'), coalesce(item->>'title',''), coalesce((item->>'dayCount')::integer,0), coalesce(item->>'hotelName',''), item, now()
    from jsonb_array_elements(coalesce($1->'travelHistoryIndex','[]'::jsonb)) as item
  $q$, v_table_index) using v_target->'travel';
  execute format($q$
    insert into %s (id,item,saved_at,updated_at)
    select key,value,coalesce(nullif(value->>'savedAt','')::timestamptz,now()),now()
    from jsonb_each(coalesce($1->'travelPlanDetails','{}'::jsonb))
  $q$, v_table_details) using v_target->'travel';
  return jsonb_build_object('revision', v_revision + 1, 'restorePointId', p_point_id, 'mainRestored', true, 'travelRestored', true);
end;
$$;

revoke all on function public.family_restore_snapshot(text,text,text,jsonb,bigint,text,text) from public, anon, authenticated;
grant execute on function public.family_restore_snapshot(text,text,text,jsonb,bigint,text,text) to service_role;

-- Main, travel index, and travel details are read by ONE SQL statement and
-- therefore one MVCC snapshot. Never replace this with separate REST reads.
create or replace function public.family_read_snapshot(
  p_main_table text, p_index_table text, p_detail_table text
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_snapshot jsonb;
begin
  execute format($q$
    select jsonb_build_object(
      'record', coalesce((select value from public.%I where key='main'), '{}'::jsonb),
      'travel', jsonb_build_object(
        'travelHistory', '[]'::jsonb,
        'travelHistoryIndex', coalesce((select jsonb_agg(summary order by saved_at desc,id) from public.%I),'[]'::jsonb),
        'travelPlanDetails', coalesce((select jsonb_object_agg(id,item) from public.%I),'{}'::jsonb)
      )
    )
  $q$, p_main_table, p_index_table, p_detail_table) into v_snapshot;
  return v_snapshot;
end;
$$;
revoke all on function public.family_read_snapshot(text,text,text) from public, anon, authenticated;
grant execute on function public.family_read_snapshot(text,text,text) to service_role;

-- Every travel mutation locks main first and advances its revision in the same
-- transaction as the index/detail/prune changes. A restore cannot miss a trip
-- saved after its preview, or observe half of a travel save.
create or replace function public.family_travel_mutate(
  p_main_table text, p_index_table text, p_detail_table text,
  p_action text, p_detail jsonb, p_summary jsonb, p_id text, p_limit integer
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_main jsonb;
  v_revision bigint;
  v_index jsonb;
  v_table_main text := format('public.%I', p_main_table);
  v_table_index text := format('public.%I', p_index_table);
  v_table_details text := format('public.%I', p_detail_table);
begin
  if p_action is null or p_action not in ('save','delete') or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Invalid travel mutation';
  end if;
  if p_action = 'save' and (p_id is null or p_id = '' or p_detail is null or p_summary is null or p_detail->>'id' is distinct from p_id or p_summary->>'id' is distinct from p_id) then
    raise exception 'Invalid travel item';
  end if;
  execute format('insert into %s (key,value,updated_at) values ($1,$2,now()) on conflict (key) do nothing', v_table_main)
    using 'main', '{}'::jsonb;
  execute format('select value from %s where key=$1 for update', v_table_main) into v_main using 'main';
  v_revision := coalesce((v_main->>'_familyRevision')::bigint,0) + 1;
  if p_action = 'save' then
    execute format($q$
      insert into %s (id,destination,date_range,saved_at,active_variant,title,day_count,hotel_name,summary,updated_at)
      values ($1,coalesce($2->>'destination',''),coalesce($2->>'dateRange',''),
        coalesce(nullif($2->>'savedAt','')::timestamptz,now()),coalesce($2->>'activeVariant','classic'),
        coalesce($2->>'title',''),coalesce(($2->>'dayCount')::integer,0),coalesce($2->>'hotelName',''),$2,now())
      on conflict (id) do update set destination=excluded.destination,date_range=excluded.date_range,
        saved_at=excluded.saved_at,active_variant=excluded.active_variant,title=excluded.title,
        day_count=excluded.day_count,hotel_name=excluded.hotel_name,summary=excluded.summary,updated_at=now()
    $q$, v_table_index) using p_id, p_summary;
    execute format($q$
      insert into %s (id,item,saved_at,updated_at) values ($1,$2,coalesce(nullif($2->>'savedAt','')::timestamptz,now()),now())
      on conflict (id) do update set item=excluded.item,saved_at=excluded.saved_at,updated_at=now()
    $q$, v_table_details) using p_id, p_detail;
    execute format('delete from %s where id in (select id from %s order by saved_at desc,id offset $1)', v_table_details, v_table_index) using p_limit;
    execute format('delete from %s where id in (select id from %s order by saved_at desc,id offset $1)', v_table_index, v_table_index) using p_limit;
  else
    if p_id is null or p_id = '' then
      execute format('delete from %s', v_table_details);
      execute format('delete from %s', v_table_index);
    else
      execute format('delete from %s where id=$1', v_table_details) using p_id;
      execute format('delete from %s where id=$1', v_table_index) using p_id;
    end if;
  end if;
  execute format('update %s set value=$1,updated_at=now() where key=$2', v_table_main)
    using v_main || jsonb_build_object('_familyRevision',v_revision), 'main';
  execute format('select coalesce(jsonb_agg(summary order by saved_at desc,id),''[]''::jsonb) from %s', v_table_index) into v_index;
  return jsonb_build_object('revision',v_revision,'index',v_index,'summary',p_summary,'detail',p_detail);
end;
$$;
revoke all on function public.family_travel_mutate(text,text,text,text,jsonb,jsonb,text,integer) from public, anon, authenticated;
grant execute on function public.family_travel_mutate(text,text,text,text,jsonb,jsonb,text,integer) to service_role;
