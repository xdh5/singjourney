# 声入佳境

声入佳境（SingJourney）是一套共享页面代码的 Web、微信小程序、iOS、Android 和 HarmonyOS 练声客户端，并配有独立 Python 服务端。

## 项目结构

```text
client/                 uni-app 多端客户端
packages/pitch-core/    实时音高检测与滤波
packages/curve-layout/  音高曲线布局
packages/contracts/     客户端共享数据结构
server/                 FastAPI、PostgreSQL 与音频存储层
```

## 客户端 Docker 构建

发布客户端前，先由服务端乐谱代码生成版本化的单音钢琴和正确曲线资产：

```bash
docker compose -f compose.client.yml run --rm --build practice-assets
```

生成产物写入 `client/src/static/practice`，普通用户点击练习时只读取缓存资产，不会在线重新合成。

```bash
docker compose -f compose.client.yml run --rm --build client-build
```

产物位于：

- `client/dist/h5`
- `client/dist/mp-weixin`
- `client/dist/ios`
- `client/dist/android`
- `client/dist/harmony`（HBuilderX/DevEco 完成 HarmonyOS 构建后规范化生成）

微信开发者工具直接导入 `client/dist/mp-weixin`。

## 服务端 Docker 启动

```bash
docker compose -f compose.server.yml up --build
```

当前服务端只开放临时录音分享；账号、同步、伴奏、练声统计和 AI 测评已经规划数据边界，但尚未提供接口。参见 [server/README.md](server/README.md)。

## 独立版本与发布

所有可发布组件的当前版本统一记录在 `release/versions.json`，但各组件独立升级：

- Web：`web-v0.1.0`
- 微信小程序：`wx-v0.1.0`
- iOS：`ios-v0.1.0`
- Android：`android-v0.1.0`
- HarmonyOS：`harmony-v0.1.0`
- Server API：`server-v0.1.0`

发布前先只修改目标组件的版本号及必要的最低兼容版本，再创建与其完全一致的 Git Tag。GitHub Actions 会拒绝 Tag 与版本清单不一致的构建。Web 和 Server Tag 分别触发部署；微信、iOS 和 Android Tag 生成各自的构建产物。HarmonyOS 使用独立版本号，但最终工程和安装包需要 HBuilderX 调用 DevEco Studio 工具链生成。各原生端共享页面和业务代码，但安装包、版本号和发布节奏相互独立。

后端接口大版本使用 `/api/v1` 这样的路径管理。新增兼容字段可以继续使用当前大版本；删除字段或改变既有语义时应增加 API 大版本，并为仍在使用的旧客户端保留旧接口。
