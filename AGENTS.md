# 项目规则

## 语言要求

- 所有注释、Markdown 和项目提示词必须使用中文。

## 构建要求

- 只使用 Docker 构建，不得使用本机的 `npm`、Vite 或 Python 重新构建。
- 日常修改客户端后只构建微信小程序，不构建 Web、iOS 或 Android：
  `docker compose -f docker/compose.client.yml run --build --rm client-build-wx`
- 永远不要自动执行正式四端构建。只有用户明确要求“完整构建”时，才运行：
  `docker compose -f docker/compose.client.yml run --build --rm client-build`
- 修改 `server/`、`deploy/`、`docker/Dockerfile.server` 或 `docker/compose.server.yml` 时，运行：
  `docker compose -f docker/compose.server.yml build api`
- 只有修改练声音频资源生成器或其输入资源时，才使用 `practice-assets` 服务重新生成资源。

## 测试要求

- 不得自行编写测试用例。
- 不运行额外测试；界面效果交给人工验收。
