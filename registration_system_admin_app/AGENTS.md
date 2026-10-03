# registration_system_admin_app 工作区说明

移动管理 App 已恢复开发，首版对接当前 Go 后端，面向赛事运营与管理员。当前范围及验收限制见 [README.md](README.md) 和 [首版验收记录](../docs/admin-app-v1-acceptance.md)。

## 协作与分层

- 修改前先读根 `AGENTS.md`、本文件和获批首版 spec；不恢复 Rust 或旧 Vue 项目，不改 Go API/schema。
- `lib/features/*/domain` 为纯 Dart 模型、规则与 repository 契约；data 负责 HTTP/JSON 映射；application 负责状态与业务编排；presentation 负责页面交互；`lib/app` 负责组合、会话与资源生命周期。
- HTTP 统一经过 ApiClient，接口为 base + `/api/v1/admin`，响应 `{code,message,data}` 成功 code=0；实际 DTO/路由以 Go 为准。
- 默认 base `https://oryjk.cn:82/regist-v3`，由 `ADMIN_API_BASE_URL` dart-define 覆盖；健康检查 base + `/health`。
- 具体时刻 UTC 传输，北京时间展示/输入；纯日期保留 `YYYY-MM-DD`。金额使用整数分，不在页面推算余额。
- AppStores 的安全存储、偏好及 pending-fund store 在整个 App 生命周期共用；环境替换使用 `forEnvironment` 或转交相同 stores，保留跨环境待确认写入的序列化。
- 401 清理受保护导航与控制器，403 保留会话；旧会话响应不能污染新账号。退出不删除待确认资金动作；不自动重放写请求。
- 共享主题位于 design_system；深色默认，浅色持久化。非声明式文件超过约 600 行先评估责任边界，避免无关重构。
- 独立离线 fixture harness 位于 `test/harness`，生产入口 `lib/main.dart` 不导入 fixture、不读取 HARNESS_*。原生验收截图与产物放忽略的 `build/`。

## 验证

所有 Flutter 测试/构建/运行串行执行，避免 native-assets 输出竞争。

```sh
dart format lib test
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --simulator
```

原生工具链及 harness 命令见 README。Android release 仍使用 scaffold debug 签名，不作为商店发行配置；iOS simulator `.app` 不是设备/商店发行包。不读/打印凭据，不向生产业务表写验收数据；没有合法账号时明确记录真实认证接口未验证。

## Android 下载交付

- 用户要求：后续 Android 版本开发完成后上传到 `http://172.16.60.233/` 的开发主页供下载，类似“抢票助手 Android”，每版必须包含 release notes。
- release notes 只写本版本新增了哪些功能、修复了哪些问题，分为“新增功能 / 问题修复”。自动整理并随包发布，无需每版确认文案；说明存放在 `releases/`，与实际安装包对应。测试范围和已知限制另列。
- 发布页面提供最新 APK、历史版本、版本名/版本代码、构建类型、发布时间、文件大小、代码提交和 SHA-256。版本与签名信息从实际 APK 核对，不能把 Debug 签名包标为商店发行包。
- 上传后从 HTTP 下载入口验证安装包哈希与更新说明；只完成构建或上传不算下载交付完成。主页部署位置、已核实参考与首版状态见 README。
