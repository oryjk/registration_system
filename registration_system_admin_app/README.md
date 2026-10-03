# 移动管理 App

面向赛事运营与管理员的 Flutter 首版，已恢复开发并对接 Go 管理协议。包含登录/会话恢复、工作台、比赛列表/创建/编辑/详情/报名花名册/状态与比分、球队维护、成员/候选/队长/会员/资料，以及人工收款、扣费、流水与合法冲正。

用户管理、管理员配置、系统设置、球队约战申请、比赛结算不在首版范围；报名只查询花名册与状态。平台构建结果、截图覆盖和真实账号验收限制见 [验收记录](../docs/admin-app-v1-acceptance.md)。

## 环境与运行

已验工具：Flutter 3.44.2 / Dart 3.12.2；Android AGP 8.12.1 / Gradle 8.14 / JDK 21 / Kotlin 2.2.20；iOS 使用 Xcode 26.6，原生插件通过 SwiftPM 自动解析，不依赖 CocoaPods。pubspec.lock 锁定依赖。Android SDK 由 Flutter/plugin 要求下载，含 API 35/36。

```sh
flutter pub get
flutter run -d <android-device-id>
flutter run -d <ios-simulator-id>
flutter run --dart-define=ADMIN_API_BASE_URL=https://example.invalid/regist-v3
```

默认 API base 为 `https://oryjk.cn:82/regist-v3`，base 与 `/api/v1/admin` 分开拼接。Go envelope 为 `{code,message,data}`，code=0 成功；健康探测为 base 下 `/health`，健康成功不代表账号/业务接口验收通过。开发构建可从“我的”切换环境；先安全退出并清空受保护导航，生产 release 不提供任意服务器输入。密码不保存，token 与待确认资金请求使用安全存储。

## 验证与构建

所有 Flutter 命令串行执行。

```sh
dart format lib test
flutter analyze
flutter test
git diff --check
flutter build apk --debug
flutter build ios --simulator
```

若使用隔离 Android SDK/JDK/Gradle，按命令设置 JAVA_HOME、ANDROID_HOME、ANDROID_SDK_ROOT、GRADLE_USER_HOME、ANDROID_USER_HOME、ANDROID_AVD_HOME；不要修改全局 Flutter 配置。网络代理需要 Java 显式接收时仅在当前命令或隔离 Gradle 用户目录设置，不能提交机器代理或绝对工具路径。

Debug APK 可安装在 Android 设备；simulator `.app` 仅用于 iOS 模拟器。Android scaffold release 当前仍引用 debug 签名，商店发布前需由项目维护者配置正式签名；iOS 设备发行需独立签名和归档，本次未作商店发布。

## 独立离线原生验收

`lib/main.dart` 是真实入口，没有 fixture 导入或 HARNESS_* 开关。`test/harness/main.dart` 通过虚构 Go envelope、内存存储驱动实际产品 repository/controller/page，不访问网络。

```sh
flutter run -d <device-id> -t test/harness/main.dart
flutter run -d <device-id> -t test/harness/main.dart --dart-define=HARNESS_SCENE=pending
flutter run -d <device-id> -t test/harness/main.dart --dart-define=HARNESS_SCENE=member-detail --dart-define=HARNESS_DARK=false --dart-define=HARNESS_WIDTH=360 --dart-define=HARNESS_TEXT_SCALE=2
```

返回 QA 菜单可切换主题、1/1.5/2 倍文本并进入各实际页面。场景包括 shell、login、match-list/detail/create/edit、team-list/detail/create/edit、members、member-detail/candidates/edit/profile、fund-history/credit/consume/reversal、pending、empty、error、long、loading。pending 需启动指定以预存原请求；loading 通过专用验收控制阻塞读请求，不建议菜单中长期停留。

仅 harness 在 `HARNESS_CONTROL=true` 时注册 `ext.adminAcceptance.configure` Dart VM service extension。参数 scene、dark、width、scale 控制离线场景；tab 调用实际底部导航（0–3），scroll=bottom 滚到当前页末尾，keyboard=show 聚焦实际输入并唤起原生键盘，orientation=portrait/landscape 请求原生旋转，retryPending=true 显式调用 fixture 原资金请求重试，longError/buildInfoError 控制离线失败反馈。`HARNESS_LONG_ACCOUNT=true` 使用虚构长环境地址。结果回传 nativeLogicalWidth/layoutWidth/nativeLogicalHeight，宽度超过原生可用宽度会被约束，不能据此声称 430 覆盖。控制接口不进入生产入口。横屏、键盘、安全区需真实模拟器操作。截图及日志放忽略的 `build/acceptance/admin-app-v1`；正式 main 包需先复制到 `build/delivery/admin-app-v1`，因为 harness 构建会覆盖普通输出位置。

## 维护边界

feature 采用 domain/data/application/presentation；页面不解析 JSON、拼 API URL 或计算余额。App 层拥有生命周期与会话导航。AppStores 在整个 App 生命周期共享，环境替换不能重建 pending store 序列化队列。资金提交先安全持久化原 key/payload，再发请求；不确定结果恢复后只能显式重试原请求，不自动重放。时间统一北京时间输入/展示、UTC 传输；金额整数分，单笔上限 10,000 元。
