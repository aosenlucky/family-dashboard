# Supabase 数据存储方案

## 结论

本项目现在以 Supabase 作为正式数据层。JsonBin 只作为旧数据迁移来源和临时回退。

Supabase 的优势：
- 旅行历史列表和详情分表存储，避免每次加载整包大 JSON。
- 后续可以继续拆分照片、书籍、待办、资产等数据表。
- 支持 Postgres / JSONB / REST API，适合长期维护。

JsonBin 的定位：
- 轻量配置或临时备份可以用。
- 不适合长期承载旅行计划、照片元数据、读书笔记等持续增长的数据。

## EdgeOne 环境变量

必填：

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

可选，默认如下：

```text
SUPABASE_MAIN_TABLE=family_records
SUPABASE_TRAVEL_INDEX_TABLE=travel_history_index
SUPABASE_TRAVEL_DETAILS_TABLE=travel_plan_details
```

迁移旧 JsonBin 数据时临时保留：

```text
JSONBIN_API_KEY=
JSONBIN_BIN_ID=
JSONBIN_TRAVEL_BIN_ID=
```

迁移完成并确认数据无误后，可以删除 JsonBin 相关变量。

## Supabase 建表 SQL

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
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
```

本项目所有 Supabase 访问都发生在服务端 API 内，并使用 `service_role` key。service role 会绕过 RLS，因此不要把它放到前端代码或 `VITE_` 环境变量里。

## 数据表说明

`family_records`
- `key = main`
- 保存家庭主配置：生活、理财、相册元数据、书籍、习惯、待办等。

`travel_history_index`
- 旅行历史摘要列表。
- 页面打开旅行模块时只读取这张表，加载速度更稳定。

`travel_plan_details`
- 按旅行 id 保存完整行程 JSON。
- 点击某条历史行程时才读取详情。

## 迁移步骤

1. 在 Supabase 执行建表 SQL。
2. 在 EdgeOne 配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。
3. 暂时保留 JsonBin 环境变量。
4. 部署完成后进入网站设置 -> 数据安全。
5. 先点击「导出完整备份」。
6. 再点击「从 JsonBin 迁移到 Supabase」。
7. 刷新后确认数据、旅行历史、照片、理财等都正常。
8. 确认无误后，可删除 JsonBin 环境变量。

## 备份恢复

设置面板「数据安全」支持：
- 导出完整 JSON 备份。
- 从 JSON 备份恢复到当前数据源。

当前如果配置了 Supabase，恢复会写入 Supabase。
