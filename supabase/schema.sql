create table if not exists public.family_records (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_history_index (
  id text primary key,
  destination text not null default '',
  date_range text not null default '',
  saved_at timestamptz not null default now(),
  active_variant text not null default 'classic',
  title text not null default '',
  day_count integer not null default 0,
  hotel_name text not null default '',
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_plan_details (
  id text primary key references public.travel_history_index(id) on delete cascade,
  item jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_history_index_saved_at_idx
  on public.travel_history_index (saved_at desc);

alter table public.family_records enable row level security;
alter table public.travel_history_index enable row level security;
alter table public.travel_plan_details enable row level security;
