# TONE

TONE 是一个完全本地运行的实时音高记录工具。目前包含 Web 和微信小程序两端，并为未来的 Swift 客户端保留共享核心边界。

## 当前功能

- 实时麦克风音高检测
- 音高曲线绘制
- 自由录音、暂停与回放
- 录音和音高轨迹本地保存
- 本地录音列表、重命名和删除
- 无账号、无上传、无服务端

## 项目结构

```text
apps/web                 Nuxt 静态 Web 应用
apps/wx                  原生 TypeScript 微信小程序
packages/pitch-core      共享音高检测与滤波
packages/curve-layout    共享曲线路径计算
packages/contracts       共享数据结构
```

## 开发与构建

```bash
npm install
npm run dev:web
npm run build:web
npm run build:wx
npm test
```

Web 静态产物位于 `apps/web/.output/public`。

微信构建后，使用微信开发者工具打开 `apps/wx`。`project.config.json` 已将小程序目录指向 `apps/wx/dist`，首次使用时请替换为自己的 AppID。

## 本地数据

- Web 使用 IndexedDB，音频 Blob 与元数据分开存储。
- 微信使用 `wx.env.USER_DATA_PATH` 保存 WAV 和曲线 JSON，使用小程序 Storage 保存索引。
- 两端数据不会自动同步，清除站点或小程序数据会删除录音。
