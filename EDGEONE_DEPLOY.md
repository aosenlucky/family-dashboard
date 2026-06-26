# EdgeOne Pages 部署说明

这个项目已保留 Vercel 兼容，同时新增 EdgeOne Pages 兼容：

- 前端：EdgeOne Pages 静态托管，构建产物为 `dist`
- 后端：EdgeOne Pages Cloud Functions，入口在 `cloud-functions/api/*`
- 原有 Vercel API：仍保留在 `api/*`

## EdgeOne Pages 项目配置

在 EdgeOne Pages 中导入 GitHub 仓库后，推荐使用：

```text
Install Command: npm ci
Build Command: VITE_ROUTER_MODE=hash npm run build
Output Directory: dist
Node Version: 22.11.0
```

这些配置也已经写入 `edgeone.json`。EdgeOne 构建时会使用 hash 路由，避免刷新 `/travel`、`/gallery` 等前端路由时 404。

## 必填环境变量

在 EdgeOne Pages 的环境变量中配置：

```text
SYSTEM_PASSWORD=
JSONBIN_API_KEY=
JSONBIN_BIN_ID=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro
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
