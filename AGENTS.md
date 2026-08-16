# 项目规则

## 语言要求

- 所有注释、Markdown 和项目提示词必须使用中文。

## 构建要求

- 只使用 Docker 构建，不得使用本机的 `npm`、Vite 或 Python 重新构建。
- 每次修改客户端后都自动构建微信小程序，不需要用户再次提醒；不构建 Web、iOS 或 Android：
  `docker compose --env-file .env -f docker/compose.client.yml run --build --rm client-build-wx`
- 永远不要自动执行正式四端构建。只有用户明确要求“完整构建”时，才运行：
  `docker compose -f docker/compose.client.yml run --build --rm client-build`
- 修改 `server/`、`deploy/`、`docker/Dockerfile.server` 或 `docker/compose.server.yml` 时，运行：
  `docker compose -f docker/compose.server.yml build api`
- 只有修改练声音频资源生成器或其输入资源时，才使用 `practice-assets` 服务重新生成资源。

## 测试要求

- 不得自行编写测试用例。
- 不运行额外测试；界面效果交给人工验收。

## 用户数据同步要求

- 所有新增的用户服务端数据都必须登记到 `client/src/services/account/data-synchronization.ts`，禁止在页面或 Store 中另写一套登录、退出同步流程。
- 集合数据按稳定 ID 合并本地与线上数据并取并集；同 ID 冲突时以线上数据为准。
- 单值数据发生冲突时以线上数据为准；只有线上没有有效值时才把本地值同步到服务器。
- 登录后仅在对应数据成功同步到服务器后清理本地副本；同步失败必须保留本地数据以便重试。
- 退出登录前必须把全部用户服务端数据同步回本地；任一关键同步失败时不得清除登录态。
