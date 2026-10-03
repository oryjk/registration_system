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

## 开发主页下载交付

用户约定：后续 Android 版本开发完成后上传到 [开发主页](http://172.16.60.233/)，提供最新 APK、历史版本与每版 release notes。**自动整理并随包发布，不需要每次确认文案**；说明只列本版“新增功能 / 问题修复”，测试范围和已知限制另列。

本 App 下载入口为 [赛事管理 Android](http://172.16.60.233/registration-admin-android/)，页面模板在 [distribution/index.html](distribution/index.html)，Nginx 路由片段在 [distribution/nginx-location.conf](distribution/nginx-location.conf)。首版说明见 [1.0.0+1](releases/1.0.0+1.md)。2026-10-03 首版 1.0.0+1（Debug）已接入主页；最新包和不可变版本文件均通过完整 HTTP 下载哈希回验，实际发布信息及验收限制见首版说明。

网关部署位置（2026-10-03 核实）：

- 通过 `ssh local233` 维护容器 `betalpha-internal-gateway-nginx-1`，配置在 `/home/betalpha/services/betalpha-internal-gateway/nginx.conf`。
- 静态根目录 `/home/betalpha/.local/share/betalpha-admin-downloads` 挂载到 `/usr/share/nginx/html`；本 App 使用独立目录 `registration-admin-android/`。
- 主页线上文件为静态根目录的 `index.html`，源文件为 `/home/betalpha/services/betalpha-internal-gateway/index.html`。修改导航时以最新线上文件为基线，同步两个文件，保留其他入口、访问限制与密码逻辑。

每版发布按以下顺序执行：

1. 完成相关验证，按本次交付范围和实际修复整理 `releases/<版本名>+<版本代码>.md`，不要直接把提交标题当作用户说明。
2. 核对实际 APK 的版本名、版本代码、应用 ID、构建类型和签名；记录构建源代码提交、字节数、SHA-256。已有验收包只在产品代码未变且来源可追溯时复用，不能把当前文档提交冒充构建源提交。
3. 在网关服务目录的 `staging/` 上传完整文件并校验哈希，再放入本 App 静态目录。版本包放 `releases/<唯一版本文件>.apk`，同名历史文件不覆盖；更新 `latest.apk`、页面、`metadata.json` 和 `releases.json`，保留完整历史。
4. `metadata.json` 包含 `versionName`、`versionCode`、`buildType`、`publishedAt`、`fileSizeBytes`、`sha256`、`gitCommit`、`releaseFile`、`releaseNotes`；`releases.json` 是同结构的数组，最新在前。`releaseFile` 是相对目录 `releases/` 下的 APK 路径，`releaseNotes` 字符串分别以 `新增：`、`修复：` 开头，页面据此分组；没有某类更新时显示“本版无此类更新”。
5. 元数据发布时间用含时区的 UTC ISO 时间，页面固定北京时间展示。页面下载按钮绑定元数据中的不可变版本文件，避免发布期间说明与下载包不一致；`latest.apk` 保留为固定下载地址。
6. 首次接入路由或修改网关时，先备份配置和主页，用容器内 `nginx -t -c <候选配置>` 验证。配置是单文件绑定挂载，须原位更新，不能通过原子重命名换掉宿主配置 inode；执行 `nginx -t` 通过后 `nginx -s reload`。失败恢复备份并重新验证，不调用会同步其他项目的 `manage.sh sync`。
7. 从 HTTP 地址完整下载 APK 并核对 SHA-256，检查版本文件和最新包、主页入口、更新说明、北京时间、网关健康及既有下载入口。只完成构建或上传不算下载交付完成。

Debug 签名包标明内部测试，正式发行需独立签名配置。真实账号验收限制如实记录。参考抢票助手的下载结构，但其原生 Gradle 发布脚本不直接用于 Flutter；目前采用上述交付流程与静态模板，没有专用上传脚本。

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
