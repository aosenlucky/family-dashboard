# EdgeOne Pages 部署说明

这个项目已保留 Vercel 兼容，同时新增 EdgeOne Pages 兼容：

- 前端：EdgeOne Pages 静态托管，构建产物为 `dist`
- 后端：EdgeOne Pages Cloud Functions，入口在 `cloud-functions/api/*`
- 原有 Vercel API：仍保留在 `api/*`

## EdgeOne Pages 项目配置

在 EdgeOne Pages 中导入 GitHub 仓库后，推荐使用：

```text
Install Command: npm ci --include=optional && npm install @rolldown/binding-linux-x64-gnu@1.0.3 --no-save
Build Command: npm run build:edgeone
Output Directory: dist
Node Version: 22.11.0
```

这些配置也已经写入 `edgeone.json`。EdgeOne 构建时会使用 hash 路由，避免刷新 `/travel`、`/gallery` 等前端路由时 404。

`edgeone.json` 还会注册 `supabase-daily-keepalive` 定时任务。它每天北京时间 03:15 调用 `/api/supabase-keepalive`，完成 3 次轻量只读查询并更新一条隔离的系统心跳记录，因此即使长期无人访问网站，也能持续产生 Supabase 数据库活动。

## 必填环境变量

在 EdgeOne Pages 的环境变量中配置：

```text
SYSTEM_PASSWORD=
WEALTH_PASSWORD=
DEMO_PASSWORD=
DEMO_WEALTH_PASSWORD=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# 或使用 Supabase 新版服务端 Secret key：
# SUPABASE_SECRET_KEY=
SUPABASE_MAIN_TABLE=family_records
SUPABASE_TRAVEL_INDEX_TABLE=travel_history_index
SUPABASE_TRAVEL_DETAILS_TABLE=travel_plan_details
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro
TRAVEL_DEEPSEEK_TIMEOUT_MS=85000
TRAVEL_EDGEONE_TIMEOUT_MS=112000
TRAVEL_COMPACT_REASONING_EFFORT=medium
TRAVEL_WORKFLOW_REASONING_EFFORT=high
TRAVEL_FOUNDATION_MAX_TOKENS=3200
TRAVEL_SKELETON_MAX_TOKENS=3600
TRAVEL_DAY_MAX_TOKENS=4200
```

密码说明：

- `SYSTEM_PASSWORD`：真实家庭空间密码，读取和保存真实 Supabase 数据。
- `WEALTH_PASSWORD`：真实理财二次验证密码，只在服务端校验，不写入 Supabase，也不会下发到浏览器。
- `DEMO_PASSWORD`：演示模式入口密码，服务端只返回 mock 数据，前端不保存、不推送、不打开配置台。
- `DEMO_WEALTH_PASSWORD`：可选，演示模式下理财二次验证密码；不填时默认使用 `DEMO_PASSWORD`。

如果需要从旧 JsonBin 数据迁移到 Supabase，迁移期间保留：

```text
JSONBIN_API_KEY=
JSONBIN_BIN_ID=
JSONBIN_TRAVEL_BIN_ID=
```

如果要保留图片上传到华为 OBS：

```text
OBS_AK=
OBS_SK=
OBS_ENDPOINT=
OBS_BUCKET_NAME=
```

如果要保留家庭通知推送：

```text
SERVERCHAN_KEY=
PUSHPLUS_TOKEN=
```

旅行图片搜索可选：

```text
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=
```

## 旅行规划超时说明

EdgeOne Pages Cloud Functions 当前单次运行最长可配置到 120 秒，本项目已经在 `edgeone.json` 中配置为 120 秒。

旅行规划仍保留流式接口：

```text
/api/travel-plan-stream
```

如果 DeepSeek 深度思考偶尔超过 120 秒，EdgeOne 仍可能终止函数。届时建议把旅行生成接口单独迁到腾讯云 SCF、CloudBase Run 或其它更长超时的后端，EdgeOne Pages 继续负责前端与国内 CDN 加速。

## 路由变化

EdgeOne 版本使用 hash 路由：

```text
/#/life
/#/travel
/#/wealth
/#/gallery
```

`edgeone.json` 里已经配置了 `/travel`、`/gallery` 等旧路径跳转到对应 hash 路径。

## 验证 Supabase 保活

完成生产部署后，访问：

```text
https://你的域名/api/supabase-keepalive
```

正常响应示例：

```json
{
  "success": true,
  "checkedAt": "2026-09-07T19:15:00.000Z",
  "durationMs": 120,
  "databaseRequests": 4,
  "databaseWrites": 1
}
```

随后可在 EdgeOne Makers 控制台的函数日志中搜索 `[supabase-keepalive]`。定时调用失败会返回 HTTP 500，并在日志中写入 Supabase 的错误详情。

仓库中的 GitHub Actions 工作流还会每 3 天调用一次 Vercel 生产接口作为冗余，并在失败时保留可见的失败记录。Supabase 项目恢复后，可先在 Actions 页面手动运行一次 `Supabase keepalive fallback` 验证整条链路。
