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
SYSTEM_PASSWORD=
WEALTH_PASSWORD=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

如果你在 Supabase 新版 API Keys 页面使用的是 Secret key，也可以配置：

```text
SUPABASE_SECRET_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` 和 `SUPABASE_SECRET_KEY` 二选一即可。本项目只在服务端 API 内读取该密钥，前端不会接触。

密码字段说明：
- `SYSTEM_PASSWORD` 负责进入家庭网站。
- `WEALTH_PASSWORD` 负责理财页面二次解锁金额。
- 旧版 `family_records.value.wealthPassword` 已废弃，数据层会在读取、保存、迁移和备份主配置时自动剥离该字段。
- 演示模式可配置 `DEMO_PASSWORD` 和 `DEMO_WEALTH_PASSWORD`，分别用于进入 mock 数据和解锁 mock 金额。

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

本项目所有 Supabase 访问都发生在服务端 API 内，并使用 `service_role` / Secret key。该类密钥会绕过 RLS，因此不要把它放到前端代码或 `VITE_` 环境变量里。

## 数据表说明

`family_records`
- `key = main`
- 保存家庭主配置：生活、理财、相册元数据、书籍、习惯、待办等。
- 不保存理财二次密码；理财密码改由 EdgeOne 环境变量 `WEALTH_PASSWORD` 管理。

如旧数据里已经存在 `wealthPassword`，可在 Supabase SQL Editor 执行一次清理：

```sql
update public.family_records
set value = value - 'wealthPassword',
    updated_at = now()
where key = 'main'
  and value ? 'wealthPassword';
```

`travel_history_index`
- 旅行历史摘要列表。
- 页面打开旅行模块时只读取这张表，加载速度更稳定。

`travel_plan_details`
- 按旅行 id 保存完整行程 JSON。
- 点击某条历史行程时才读取详情。

## 迁移步骤

1. 在 Supabase 新建项目，保存好数据库密码。
2. 在 Supabase SQL Editor 执行本文件中的建表 SQL，确认三张表都创建成功。
3. 在 Supabase Dashboard 获取 `Project URL`，填入 EdgeOne 的 `SUPABASE_URL`。
4. 在 Supabase API Keys 页面复制服务端密钥：新版用 Secret key，旧版用 `service_role` key。填入 EdgeOne 的 `SUPABASE_SECRET_KEY` 或 `SUPABASE_SERVICE_ROLE_KEY`。
5. 在 EdgeOne 配置表名变量：`SUPABASE_MAIN_TABLE`、`SUPABASE_TRAVEL_INDEX_TABLE`、`SUPABASE_TRAVEL_DETAILS_TABLE`。
6. 迁移期间暂时保留 JsonBin 环境变量：`JSONBIN_API_KEY`、`JSONBIN_BIN_ID`、`JSONBIN_TRAVEL_BIN_ID`。
7. 重新部署 EdgeOne。
8. 部署完成后进入网站设置 -> 数据安全。
9. 先点击「导出完整备份」，下载一份本地兜底。
10. 再点击「从 JsonBin 迁移到 Supabase」。
11. 刷新页面，分别检查生活、理财、画廊、旅行历史是否正常。
12. 确认无误后，可删除 JsonBin 环境变量，避免后续误回退。

## 备份恢复

设置面板「数据安全」支持：
- 导出完整 JSON 备份。
- 从 JSON 备份恢复到当前数据源。

当前如果配置了 Supabase，恢复会写入 Supabase。
