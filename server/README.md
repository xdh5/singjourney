# 后端部署

后端使用 Cloudflare Workers 和 D1，练声音频保存在私有 R2 桶 `singjourney-practice-audio`。不提供 Web 网站，也不绑定其他静态服务。

- `src/index.js`：微信登录、用户资料、练声记录、收藏、统计、埋点及音频读取接口。
- `wrangler.jsonc`：正式域名、D1 和 R2 绑定配置。
- `practice/`：乐谱及音频资源的 Python 生成源码。
- `generate-scores.py`：构建时生成播放清单所需的乐谱 JSON，不重新渲染音频。
- `package.json`：后端版本、发布命令和 Wrangler 依赖。

所有接口和音频保持原地址，微信小程序无需修改服务器白名单。用户数据继续使用现有 D1 数据库，目录清理不会重新导入或覆盖数据。

## 构建与发布

```powershell
docker compose -f docker/compose.server.yml build api
```

GitHub Actions 只保留“后端发布”。推送后端源码后由 Docker 构建，并直接发布 Workers。小程序不通过 GitHub Actions 发布。

微信 AppID 和 AppSecret 使用 Workers Secrets：`WECHAT_APP_ID`、`WECHAT_APP_SECRET`。GitHub 使用 `CLOUDFLARE_API_TOKEN` 发布，不保存用户数据备份。

仅在修改音频生成器或其输入时，使用 `practice-assets` 服务重新生成母带，再在 Docker 容器内执行 R2 上传：

```sh
npx wrangler r2 object put singjourney-practice-audio/文件名.opus --file /音频目录/文件名.opus --content-type audio/ogg --remote
```

音频由原域名流式读取，支持缓存和字节范围请求。R2 使用标准存储免费额度，超额度可能收费。用户数据与 Git 历史恢复备份仅保存在本地忽略目录 `.migration/`。
