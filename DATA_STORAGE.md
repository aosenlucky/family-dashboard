# 数据存储与备份方案

## 当前推荐

短期继续兼容 JsonBin，新增 `JSONBIN_TRAVEL_BIN_ID` 把旅行数据从主家庭配置中拆出去。

长期建议迁移到 Supabase：
- 主数据、旅行索引、旅行详情可以分 key 存储，避免整包 JSON 越来越大。
- 查询历史列表时只读索引，点开后再读详情。
- 后续可以继续拆成真正的表结构，例如 `travel_plans`、`books`、`photos`、`todos`。

## JsonBin 环境变量

```text
JSONBIN_API_KEY=
JSONBIN_BIN_ID=
JSONBIN_TRAVEL_BIN_ID=
```

`JSONBIN_TRAVEL_BIN_ID` 可选；不配置时，旅行数据会继续保存在主 Bin 内，但代码会尽量避免主数据保存时覆盖旅行字段。

## Supabase 环境变量

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_TABLE=family_records
```

只要同时配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，服务端会优先使用 Supabase；否则回退到 JsonBin。

`SUPABASE_SERVICE_ROLE_KEY` 只能放在服务端环境变量中，不能暴露给前端。

## Supabase 建表 SQL

```sql
create table if not exists public.family_records (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.family_records enable row level security;
```

当前服务端使用 service role key 访问，service role 会绕过 RLS。不要把 service role key 写进前端代码。

## 数据结构

`main`：
- 家庭配置
- 生活模块
- 理财模块
- 相册元数据
- 读书数据

`travel`：
- `travelHistoryIndex`：旅行历史摘要列表
- `travelPlanDetails`：按 id 存储完整旅行计划
- `travelHistory`：旧结构兼容字段，会在新写入时清空

## 备份恢复

设置面板的「数据安全」页签支持：
- 导出完整 JSON 备份
- 从 JSON 备份恢复

备份包含：
- `main`
- `travel`
- `storageBackend`
- `exportedAt`
