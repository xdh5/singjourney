# 声刻度

声刻度（SingJourney）是一套共享页面代码的 Web、微信小程序、iOS、Android 和 HarmonyOS 练声客户端，并配有独立 Python 服务端。

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

日常开发可只构建受影响的平台，例如音调仪微信小程序：

```bash
docker compose -f compose.client.yml run --rm --build client-build-wx-pitch
```

其他单端服务名为 `client-build-web`、`client-build-wx-practice`、`client-build-ios` 和 `client-build-android`；全量 `client-build` 留给共享核心改动和发布前验证。

产物位于：

- `client/dist/h5`
- `client/dist/mp-weixin/pitch-meter`
- `client/dist/mp-weixin/vocal-practice`
- `client/dist/ios`
- `client/dist/android`
- `client/dist/harmony`（HBuilderX/DevEco 完成 HarmonyOS 构建后规范化生成）

微信开发者工具分别导入 `client/dist/mp-weixin/pitch-meter` 和 `client/dist/mp-weixin/vocal-practice`。构建时通过 `SINGJOURNEY_PITCH_MINI_PROGRAM_APP_ID` 与 `SINGJOURNEY_PRACTICE_MINI_PROGRAM_APP_ID` 配置两个独立 AppID。

## 服务端 Docker 启动

```bash
docker compose -f compose.server.yml up --build
```

当前服务端开放临时录音分享、练声小程序微信登录和真实练声统计；微信登录还需配置 `SINGJOURNEY_WECHAT_PRACTICE_APP_ID` 与 `SINGJOURNEY_WECHAT_PRACTICE_APP_SECRET`。练习自然完成后会按登录用户记录次数与有效时长，统计接口不上传录音或曲线。云端录音同步、在线伴奏和 AI 测评尚未提供接口。参见 [server/README.md](server/README.md)。

## 独立版本与发布

所有可发布组件的当前版本统一记录在 `release/versions.json`，但各组件独立升级：

- Web：`web-v0.1.0`
- 音调仪微信小程序：`wx-pitch-v0.1.0`
- 练声微信小程序：`wx-practice-v0.1.0`
- iOS：`ios-v0.1.0`
- Android：`android-v0.1.0`
- HarmonyOS：`harmony-v0.1.0`
- Server API：`server-v0.1.0`

发布前先只修改目标组件的版本号及必要的最低兼容版本，再创建与其完全一致的 Git Tag。GitHub Actions 会拒绝 Tag 与版本清单不一致的构建。Web 和 Server Tag 分别触发部署；微信、iOS 和 Android Tag 生成各自的构建产物。HarmonyOS 使用独立版本号，但最终工程和安装包需要 HBuilderX 调用 DevEco Studio 工具链生成。各原生端共享页面和业务代码，但安装包、版本号和发布节奏相互独立。

后端接口大版本使用 `/api/v1` 这样的路径管理。新增兼容字段可以继续使用当前大版本；删除字段或改变既有语义时应增加 API 大版本，并为仍在使用的旧客户端保留旧接口。
