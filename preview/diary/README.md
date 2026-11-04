# 独立日记预览

本目录保留独立预览入口，复用 `src/features/diary/` 的日记功能。正式网站通过 `/diary` 路由进入，并沿用家庭网站导航与登录门禁。预览和正式日记使用不同的 IndexedDB 名称，不会自动迁移或混用。

## 打开与运行

在仓库根目录运行：

```powershell
node node_modules/vite/bin/vite.js --config preview/diary/vite.config.js
```

- [示例体验](http://127.0.0.1:5178/?demo=1)：虚构内容，只在内存中运行，刷新恢复示例。
- [建立或打开加密日记](http://127.0.0.1:5178/)：使用当前浏览器的本机存储。
- [手机尺寸示例](http://127.0.0.1:5178/mobile.html)：375、390 宽度及横屏 iframe 预览，不代替真机验证。

导航中的「生活」返回已有的 `5176` 预览。如需同时运行：

```powershell
node node_modules/vite/bin/vite.js --config preview/our-page/vite.config.js
```

## 本版功能

- **写下**：直接写正文，没有引导问题；日期默认今天，可补记。文字或照片即可保存，最多 4 张照片，输入自动保存加密草稿。
- **翻看**：按日期浏览、全文搜索、月份筛选、月历和收藏；支持编辑、最近 5 个旧版本与回收站恢复。
- **回顾**：周/月本地整理，收藏优先展示 3 个不同日期的片段，随时查看原文；可写自己的总结，月回顾也带出保存过的周总结。
- **温和的回看入口**：保存后可翻回一篇旧日记；单篇可关闭再次浮现。上周/上月有记录且尚未看过时，显示轻量回顾提示，不设置连续天数或缺席惩罚。
- **可选 AI 素材**：自行选择记录、预览完整文字，再下载明文素材。不会调用任何 AI 服务，也不包含照片。

## 加密与数据范围

使用 Web Crypto 的 AES-256-GCM。随机 256 位数据密钥分别由日记口令和随机恢复码保护；口令使用 PBKDF2-SHA256、随机盐和 600,000 次迭代。每次加密使用新 96 位 IV，并将日记标识、版本与用途绑定到认证数据。

称呼、正文、照片、草稿、收藏、旧版本、回收站、回顾内容及已查看状态都包含在加密载荷中。IndexedDB `family-private-diary-preview-v1` 的 `vault/main` 只存加密封装。口令不持久化；解锁密钥仅保留在页面内存中，锁定后移除引用和正文 DOM。JavaScript 运行时不保证所有内存副本被立即擦除。

离开页面立即遮盖；离开满 1 分钟或连续 5 分钟无操作时自动锁定。锁定前先保存最新草稿，保存失败则保留内存内容并遮盖页面，供用户导出或重试。浏览器后台计时可能被系统延迟。

保存使用 IndexedDB 事务与版本检查，阻止旧窗口覆盖新内容。冲突时先导出当前加密副本，再明确确认是否放弃本页修改并读取最新日记。

当前每个浏览器存储空间只有一本日记，正式入口位于家庭网站登录之后。本段描述独立预览；正式个人账号支持多端同步。不同浏览器、端口或设备不会自动共享内容。正式版使用个人身份校验及密文同步。

请下载加密备份，并单独保管恢复码。口令与恢复码都丢失时无法找回内容；清理浏览器数据会移除本机副本。加密无法保护已解锁页面、同源恶意脚本或被入侵的设备。此预览未经过独立安全审计。

备份包含当前草稿和回收站。导入先验证文件、解锁检查，再明确确认替换本机内容；不会合并两份日记。修改口令不影响恢复码，以前下载的备份仍使用原口令。当前导入文件上限为 50 MB；本版整体加密载荷的方式适合少量试用，长期大量照片需要分块存储方案。

## 验证

核心测试无需新增依赖：

```powershell
node --test preview/diary/tests/crypto-model.test.js
```

交互检查将真实 Vue 组件编译到临时目录，在 JSDOM 与 fake-indexeddb 中运行，不访问用户浏览器或私人数据。测试依赖放在临时目录，不改主项目依赖：

```powershell
npm install --prefix "$env:TEMP/family-diary-qa-deps" --no-save --package-lock=false --no-audit --no-fund fake-indexeddb@6.2.4 jsdom@26.1.0
node --test preview/diary/tests/crypto-model.test.js preview/diary/tests/integration.check.js preview/diary/tests/production.check.js
node node_modules/vite/bin/vite.js build --config preview/diary/vite.config.js
```

也可通过 `DIARY_QA_MODULES` 指向包含测试依赖 `node_modules` 的目录。

已验证错误口令拒绝、密文篡改拒绝、恢复码、修改口令、新 IV、照片及草稿加密、周月边界、指定素材导出、真实组件草稿自动保存、锁定、并发冲突、导入恢复和重新打开。浏览器视觉与真机上传检查未完成：Windows Computer Use 因无法可靠确认浏览器当前网址而中止；未尝试绕过该限制。

## 正式入口

正式网站 `/diary`（EdgeOne 为 `/#/diary`）使用个人日记账号及加密云同步。独立预览和家庭演示仍为隔离示例。旧版本机数据可在原设备迁入新账号；详见根目录 `DATA_STORAGE.md` 的「私人日记」。
