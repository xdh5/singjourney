# 声刻度项目

这是声刻度的统一代码仓库。Web、App 和微信小程序共享客户端页面与组件，业务接口封装在 `services` 中，运行端差异和通用能力封装在 `utils` 中；服务端提供练声统计、登录、埋点和数据接口。

## 目录结构

```text
singjourney/
├─ .github/              GitHub Actions 工作流
├─ client/               Web、App、微信小程序统一客户端
│  ├─ scripts/           客户端构建脚本
│  ├─ src/
│  │  ├─ assets/         由代码引用并参与打包的资源
│  │  ├─ components/     多个页面复用的 UI 组件
│  │  ├─ config/         客户端运行配置
│  │  ├─ i18n/           国际化初始化
│  │  ├─ locale/         中英文文案
│  │  ├─ pages/          按页面分目录；页面私有组件放在各自 components 中
│  │  ├─ services/       按业务域组织的后端接口调用
│  │  ├─ stores/         Pinia 全局业务状态
│  │  ├─ static/         原样复制到产物的静态资源
│  │  ├─ styles/         跨端基础样式与通用工具类
│  │  ├─ utils/          无业务页面含义的通用能力和跨端适配
│  │  │  ├─ audio/       音频文件、播放、录制、编码和 WAV 转换
│  │  │  ├─ http/        统一 HTTP 请求、接口地址、鉴权和登录
│  │  │  ├─ pitch/       音高画布、绘制和 Worker
│  │  │  ├─ recording/   录音存储、列表、播放状态和工具栏规则
│  │  │  └─ practice/    练声播放与数据类型等本地能力
│  │  └─ workers/        音高分析 Worker 源码
│  └─ targets/           Web、App、微信的独立发版版本
├─ deploy/               服务端部署辅助配置
├─ docker/               Dockerfile、Compose 和构建忽略规则
├─ packages/             客户端共用的音高算法、曲线计算和数据类型
├─ release/              Release Please 配置和版本清单
├─ server/               Python API、数据库迁移和后台任务
├─ AGENTS.md              Codex 项目执行规则
├─ package.json           npm workspace 与统一构建命令
└─ package-lock.json      npm 依赖锁文件
```

客户端样式使用 `uni.scss` 管理主题变量，使用 `uni-scss` 管理通用工具类，并按需使用 `uni-ui` 组件。跨页面共享的状态使用 Pinia；录音帧、音高画布和播放器等高频瞬时状态保留在对应页面或能力模块中。

## 代码规范

客户端使用 ESLint 检查 Vue 和 TypeScript，使用 Prettier 统一 Vue、TypeScript、SCSS、JSON 和构建脚本格式。

```powershell
docker compose -f docker/compose.client.yml run --build --rm client-lint
docker compose -f docker/compose.client.yml run --build --rm client-format
```

npm 与 Docker 客户端构建统一使用 `https://registry.npmmirror.com`。

## Docker 构建

在项目根目录执行。

构建用于上传发布的微信小程序（固定连接正式接口）：

```powershell
docker compose -f docker/compose.client.yml run --build --rm client-build-wx
```

本地联调微信小程序（从 `.env` 读取 `SINGJOURNEY_CLIENT_API_BASE_URL`）：

```powershell
docker compose --env-file .env -f docker/compose.client.yml run --build --rm client-build-wx-dev
```

两条命令的产物都写入 `client/dist/mp-weixin`，微信开发者工具保持打开该目录即可。正式构建不再读取本地接口地址，避免把局域网地址打进发布包；两条命令均不构建 Web、iOS 或 Android。

构建 Web、App 和微信小程序：

```powershell
docker compose -f docker/compose.client.yml run --build --rm client-build
```

构建服务端镜像：

```powershell
docker compose -f docker/compose.server.yml build api
```

重新生成练声音频资源：

```powershell
docker compose -f docker/compose.client.yml run --build --rm practice-assets
```

## 版本管理

Release Please 管理四个独立发布版本：

- Web：`web-v*`
- App：`app-v*`
- 微信小程序：`wx-v*`
- 服务端：`server-v*`

版本配置位于 `release/`，各客户端发布版本位于 `client/targets/`。日常提交使用 Conventional Commits，例如：

```text
fix: 修复录音播放问题
feat: 增加练声统计功能
```

Release Please 会自动创建发版 PR；合并发版 PR 后创建对应 Tag 和 GitHub Release。微信小程序仍通过微信发布工具上传和审核，不通过 GitHub 发布。
