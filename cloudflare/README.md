# Cloudflare 部署

正式环境的接口、数据库、音频和 Web 分别部署，仓库只保存源码与配置。

| 内容 | 保存位置 |
| --- | --- |
| 用户、微信身份、登录会话、练声记录和收藏 | D1 数据库 `singjourney` |
| 练声音频母带 | 私有 R2 桶 `singjourney-practice-audio` |
| Web 构建产物 | 独立静态服务 `singjourney-web` |
| 接口代码 | Workers 服务 `singjourney` |

接口服务绑定 `DB`、`AUDIO` 和 `WEB`。Web 请求通过内部服务绑定转发；音频由接口直接从 R2 流式返回，保留原路径 `/api/v1/practice/assets/文件名`、缓存与字节范围读取。原域名和小程序白名单保持不变。

## 构建和发布

全部使用 Docker，不运行本机 npm、Vite 或 Python 构建。

- 接口：GitHub Actions 在推送源码后构建并直接发布 Workers，构建期间使用 `generate-scores.py` 从现有 Python 乐谱源码生成 JSON，不渲染音频、不提交生成文件。
- Web：手动触发“Web 构建与发布”，使用 Docker 仅构建 Web，然后直接发布到 `singjourney-web`；不会覆盖接口或音频。
- 音频：仅当资源生成器或输入资源变化时使用既有 `practice-assets` 服务生成，然后通过 R2 上传命令发布。平时修改接口不重新生成或上传音频。

本地构建接口：

```powershell
 docker compose -f docker/compose.cloudflare.yml run --build --rm cloudflare
```

使用已配置凭据的发布容器上传母带：

```sh
npx wrangler r2 object put singjourney-practice-audio/文件名.opus --file /音频目录/文件名.opus --content-type audio/ogg --remote
```

此命令只在 Docker 容器内执行。R2 不开放公共桶地址，音频仍由原域名提供访问。

## 凭据与数据备份

GitHub Actions 使用 `CLOUDFLARE_API_TOKEN`；权限涵盖 Workers 发布、R2 对象上传及必要的 D1 访问。微信密钥只保存在接口服务的 Workers Secrets 中。

2026 年 10 月 23 日迁移时保留了 8 个用户、8 条微信身份、14 条登录会话、138 条练声记录和 5 个收藏。用户数据没有进入 Git。

`.migration/` 保存本地迁移备份和清理前 Git 恢复包，已被 Git 忽略。禁止将用户数据库备份、凭据、Web 产物、音频产物或生成的乐谱 JSON 提交到仓库。

R2 使用标准存储免费额度；超出存储和操作额度可能收费。域名仍单独续费。
