# 声迹服务端

当前服务端只开放健康检查和 7 天有效的录音分享接口。账号、云端录音、伴奏、练声统计与 AI 测评只有数据库边界，尚未开放接口。

客户端统一使用 `https://singjourney.com`，公开端点集中定义，页面与业务模块不得写死服务域名。

## 目录

```text
app/
  api/                 API 总路由
  core/                配置等跨模块能力
  db/                  SQLAlchemy 元数据与会话
  modules/
    accounts/          用户、第三方身份、登录会话
    media/             音频资产、未来的云端录音
    sharing/           当前已实现的临时分享
    practice/          伴奏与练声会话数据模型
    evaluations/       AI 测评与五维结果数据模型
  storage/             文件存储适配层，本地开发磁盘与生产 R2
  jobs/                定时清理等后台任务
migrations/            Alembic 数据库迁移
```

业务代码按领域组织。未来增加登录或测评时，在对应模块内增加 `router.py`、`schemas.py` 和 `service.py`，不把所有接口堆进一个文件。

## 数据原则

- PostgreSQL 只保存结构化数据和音频元数据，不保存大体积音频二进制。
- 音频通过 `storage_key` 指向文件存储；本地开发使用磁盘，生产环境可替换成 S3 兼容对象存储。
- 本地练声记录不会因为建表而自动上传。`recordings` 只用于用户主动开启的跨端同步。
- 分享使用单独的 `recording_shares` 和临时 `audio_assets`，默认 7 天过期，不会变成永久云端录音；独立清理进程默认每小时删除已过期的文件与元数据。
- 生产环境普通 API 与 PostgreSQL 部署在阿里云，临时分享音频使用 Cloudflare R2；上传与播放采用客户端直连对象存储，避免占用 API 服务器带宽。
- 测评结果保存算法及模型版本，后续更新算法时可以复现和比较结果。

详细规划见 [docs/data-model.md](docs/data-model.md) 和 [docs/audio-formats.md](docs/audio-formats.md)。

## Docker 启动

从仓库根目录执行：

```bash
docker compose -f compose.server.yml up --build
```

服务启动时自动执行 Alembic 迁移：

- API：`http://localhost:8000`
- 接口文档：`http://localhost:8000/docs`
- 存活检查：`http://localhost:8000/health/live`
- 就绪检查：`http://localhost:8000/health/ready`

独立清理容器默认每小时执行；也可以手动执行一次：

```bash
docker compose -f compose.server.yml exec api python -m app.jobs.cleanup_expired_shares
```

## 当前分享接口

- `POST /api/v1/shares`：提交音频元数据和曲线，取得短期 R2 PUT 地址。
- `POST /api/v1/shares/{id}/complete`：通过 R2 HEAD 校验大小与类型并激活分享。
- `GET /api/v1/shares/{id}`：获取公开分享数据。
- `GET /api/v1/shares/{id}/audio`：校验有效期后跳转至短期 R2 GET 地址，API 不转发音频字节。
- `DELETE /api/v1/shares/{id}`：凭创建时返回的删除令牌提前删除。

## Cloudflare R2 配置

1. 创建私有 Bucket `singjourney-share-audio`，并给 `shares/` 前缀配置 7 天删除生命周期规则。
2. 创建仅限该 Bucket 的 Object Read & Write API Token。
3. 在部署环境设置 `SINGJOURNEY_STORAGE_BACKEND=cloudflare_r2`、Account ID、Access Key ID、Secret Access Key 和 Bucket 名称；密钥不得提交到 Git。
4. Web 直传需要在 Bucket CORS 中允许正式 Web 域名执行 `PUT`，并允许 `Content-Type` 请求头。

创建接口使用 JSON 提交标题、时长、曲线及音频大小/类型；音频随后通过短期 PUT 地址直传 R2。当前单次音频上限为 25 MiB。
