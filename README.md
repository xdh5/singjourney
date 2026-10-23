# 声刻度

项目只保留微信小程序和 Cloudflare 后端。

- `client/`：微信小程序页面、组件及录音、练声能力。
- `server/`：Workers 接口、D1 与 R2 配置，以及练声乐谱和音频生成源码。
- `packages/`：小程序使用的音高算法、曲线计算和共享数据类型。
- `docker/`：小程序、后端和音频资源的 Docker 构建配置。
- `.github/workflows/server-ci.yml`：唯一的 GitHub Action，仅构建并发布后端。

客户端版本保存在 `client/package.json`，后端版本保存在 `server/package.json`。不再使用按平台拆分的目录或自动版本发布流程。

## Docker 构建

正式微信小程序：

```powershell
docker compose --env-file .env -f docker/compose.client.yml run --build --rm client-build-wx
```

产物写入 `client/dist/mp-weixin`，微信开发者工具打开该目录即可。客户端修改后自动执行上述构建。

后端构建：

```powershell
docker compose -f docker/compose.server.yml build api
```

后端发布由 GitHub Actions 完成，使用 `CLOUDFLARE_API_TOKEN`。接口仍为 `https://singjourney.com/api/v1`。根路径不再提供网站。

仅修改音频生成器或输入资源时，才使用 `practice-assets` 服务生成资源，再上传至 R2。平时构建小程序和后端不会重新生成音频。

用户数据保存在 D1，音频保存在 R2。禁止将凭据、用户备份或构建产物提交到 Git。
