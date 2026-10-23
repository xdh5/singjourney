# Cloudflare 部署

正式环境使用 Workers、D1 和 Workers 静态资源，不依赖腾讯云服务器、PostgreSQL 托管或对象存储。

2026 年 10 月 23 日迁移：完整保留 8 个用户、8 条微信身份、14 条登录会话、138 条练声记录和 5 个收藏，其余业务表也完整迁移。最终冻结快照与导入快照的数据行一致。

## 资源与兼容性

- 域名保持 `singjourney.com`，接口保持 `/api/v1`。
- D1 绑定名为 `DB`，保留用户 ID、微信身份、登录会话、收藏和练声记录。
- 乐谱继续由现有 Python 实现生成，Workers 根据音域裁剪权威乐谱，音频使用已有母带。
- `public/` 内放 Web 已有产物，`public/api/v1/practice/assets/` 放练声母带。
- 这些静态文件和 `src/generated.json` 是已验收发布快照，纳入版本管理。更新 Web 时需先更新快照再发布；日常微信改动不构建 Web。
- 密钥使用 Workers Secrets：`WECHAT_APP_ID`、`WECHAT_APP_SECRET`；禁止提交密钥和用户数据。

## Docker 构建

```powershell
docker compose -f docker/compose.cloudflare.yml run --build --rm cloudflare
```

部署时用同一服务执行 `npx wrangler deploy`。迁移不会触发 Web 或四端重新构建。

## 数据迁移

`export-data.py` 在旧 API 容器内运行，以只读一致性快照导出完整表结构和数据到 `/tmp/migration.sql`，同时导出权威乐谱到 `/tmp/generated.json`。

先保存 PostgreSQL 完整备份，再将 SQL 导入新的空 D1 数据库。用户数据备份仅存于忽略目录 `.migration/`，不进入 Git。

最终切换需暂停旧 API 写入、导出最终快照并核对所有表数量，再绑定正式域名。保留旧服务器备份直到人工验收完成。数据库回退必须包含切换后的新增数据，禁止直接恢复旧快照覆盖新写入。

## 配额

Workers 免费方案包含每天十万次请求和每请求十毫秒 CPU；D1 免费额度按读写行数计费限制。当前不使用 R2。域名费用单独续费。

## 发布凭据

GitHub Actions 使用 `CLOUDFLARE_API_TOKEN`，权限应仅覆盖目标账号的 Workers 脚本、静态资源发布和 D1 读写。正式域名绑定只在初次切换执行。禁止把临时 OAuth 令牌配置成长期 CI 凭据。
