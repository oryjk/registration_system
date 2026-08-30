# 工作区说明（给 AI / Agent）

本仓库是一个**赛事报名与球队管理**工作区，当前包含以下彼此协作的子项目（`registration_system_h5/` 为规划待创建）：

| 目录 | 说明 | 技术栈 |
| --- | --- | --- |
| `registration_system_mini/` | 微信小程序/H5 端，面向球员/队员/普通用户；**已对接 Go 新后端**（验收环境 oryjk.cn:82，`mini-rust-backend-final` 标记最后一个对接 Rust 后端的基线） | `uni-app + Vue 3 + TypeScript + Vite` |
| `registration_system_backend_fe_go/` | 对接 Go 新后端的管理后台新版本 | `React + TypeScript + Vite + shadcn/ui（+ reui registry）+ Tailwind CSS 4` |
| `registration_system_admin_app/` | 移动管理 App，面向赛事运营/管理员；**已暂停开发** | `Flutter + Dart` |
| `registration_system_go/` | **当前唯一在开发的后端服务端**，承载认证、球队与比赛 API | `Go + Gin + PostgreSQL + pgx + sqlc` |
| `registration_system_h5/` | **web-view 内嵌 H5 页面专用项目（规划，待创建）**：承载只跑在 H5 环境的页面（小程序 web-view 嵌页、微信内浏览器页面等），不再塞进 uni-app 双端代码库；产物为静态文件，部署推送到 jd 服务器的 nginx，经 `https://match.oryjk.cn`（443，web-view 业务域名）对外服务 | 待定（建议 `Vue 3 + TypeScript + Vite` 纯 Web 技术栈） |

## 后端演进状态（重要）

- **Rust 项目（`registration_system_rs/`）已停止开发并从工作区删除**（2026-08-30，需要时从 git 历史找回）：不要恢复、重建或修改它。旧库迁移不依赖该目录（`migrate-legacy.sh` 直连线上旧库 `rs_*` 表），线上旧结构数据仍保留作为迁移源。
- **所有后端开发都在 `registration_system_go/` 上进行**：历史数据已通过 `registration_system_go/scripts/migrate-legacy.sh` 迁入 Go 结构（独立库 `registration_system_go`）；后续增量迁移、新功能全部落在 Go 项目。
- 小程序（`registration_system_mini/`）当前对接 Go 后端；旧版 Vue 管理端 `registration_system_backend_fe/` 已从工作区删除（需要时从 git 历史找回），Go 配套管理端是 `registration_system_backend_fe_go/`。
- out109 验收环境（Go 后端 + mini H5 + Go 管理端）统一使用根目录 `deploy_out109_go_h5.sh` 部署。
- 微信小程序（mp-weixin）发布用 `registration_system_mini` 的 `bun run mp:release` 上传开发版本，**robot 双轨约定**：`robot=1`（默认）日常开发版，`robot=2` 体验版专用线（`-- --robot 2`；体验版随该槽位上传自动更新，首次需在公众平台点一次「选为体验版」）。详细流程与前置条件见 `registration_system_mini/AGENTS.md` 的「微信小程序发布」一节。

## 文档规范

- 工作区与子项目协作文档统一使用 `AGENTS.md`（大写命名）。
- 修改任一子项目前，先阅读：
  1. 根目录的 `AGENTS.md`
  2. 目标子项目目录下的 `AGENTS.md`

## 通用约定

- 与用户沟通优先使用**简体中文**。
- 不要臆造接口、字段、表结构；以代码、路由、DTO、SQL 迁移为准。
- **兼容性硬规则**：接口与数据结构变更必须保证**已发布（旧版本）小程序请求新后端不报错**——不删除/改名既有路由，不删除既有请求/响应字段或改变其类型，不让旧客户端的既有调用从成功变为失败。新增路由、新增字段、放宽限制都允许。若业务上确实要让旧客户端的某个既有调用开始失败（如禁止某类操作），属于产品决策：必须显式告知用户影响面，由用户拍板后才可实施。
- 后端遵循**六边形 / 整洁分层**：`domain` / `application` / `ports` / `adapters`。
- 管理端接口通常在 `/api/admin` 前缀下，常见响应为 `ApiResponse<T>`。
- 小步修改，优先做**可验证**且范围清晰的变更，避免无关重构。

## AI 编程与代码可维护性

- 代码整洁度、模块边界和文件规模会直接影响后续 AI/Agent 修改质量；现有代码会被 AI 当作模式学习和上下文依据。
- 不要因为“AI 能写代码”而放松工程约束；长期维护的真实系统要优先保持职责清晰、命名一致、接口可信、验证可执行。
- 避免在同一个大文件里继续堆叠状态、接口调用、权限判断、表单校验、业务规则和响应组装。
- 不是按行数机械拆文件，但非声明式文件超过约 `600` 行要警惕，超过约 `1000` 行应优先评估是否拆分；`2000` 行以上通常对 AI 长期维护不友好。
- 非声明式文件通常指包含业务流程、状态变化、条件分支、接口调用或副作用的页面、service、handler、repository 等文件。
- 配置、路由表、类型定义、静态映射等声明式大文件可以接受，但必须保持分区清晰、命名稳定、修改点容易定位。
- 拆分优先按职责和变化原因，而不是为了缩短文件：常一起改的代码可以放一起，不常一起改的代码应拆开。
- 优先形成“小而高内聚”的文件：每个文件有清楚职责和可预测修改点；不要为了行数过度拆分，也不要在大文件里混放多个变化原因。
- 前端页面优先保持为展示与交互编排层；可复用状态、接口适配、表单规则、业务判断应视情况抽到 composable、service、utils、子组件或类型文件。
- 后端 handler 只做协议适配、鉴权入口、DTO 转换和响应组装；业务规则放在 `domain` / `application`，持久化细节放在 `adapters`。
- 修改大文件时采用“顺手小步拆分”：只抽离当前任务相关且边界清楚的一小块，避免借机大范围重构。
- 新增代码前先搜索是否已有同类函数、DTO、组件或 use case，避免 AI 生成重复实现。

## 子项目入口

- 小程序入口：`registration_system_mini/src/main.ts`、`src/pages.json`
- Go 配套管理端入口：`registration_system_backend_fe_go/src/main.tsx`、`src/App.tsx`
- 移动管理 App 入口（已暂停）：`registration_system_admin_app/lib/main.dart`
- Go 后端入口：`registration_system_go/cmd/api/main.go`、`internal/bootstrap/`

## 联动规则

- 新后端功能只写入 `registration_system_go/`；旧 Rust 后端 `registration_system_rs/` 已从工作区删除，任何任务都不要重建或修改它。核对旧实现时需要的话从 git 历史检出该目录只读查看，看完不要提交回来。
- 旧 Rust 链路的配套老管理端 `registration_system_backend_fe/` 同样已删除，两者都不再联动修改。
- 改 Go 后端时，联动检查对接 Go 的管理端：`registration_system_backend_fe_go/src/api/`；小程序已对接 Go，用户端接口变更需同时检查 `registration_system_mini/src/api/`。
- `registration_system_mini/` 是唯一的小程序代码库；**H5-only 页面不要加进 uni-app 项目**，统一放到 `registration_system_h5/`（见项目表）。小程序内打开 H5 页面走 web-view 嵌页（`registration_system_mini/src/utils/webview.ts` 的 `navigateToWebView`），登录态用一次性 code 兑换协议（签发 `POST /api/v1/app/auth/webview-codes`、兑换 `POST /api/v1/app/auth/webview-codes/exchange`，桥接参数 `webview_code`/`webview_identity_kind`/`webview_identity_team_id`）——`registration_system_h5/` 创建时必须实现同一套协议，细节见 `registration_system_mini/AGENTS.md` 的「web-view 嵌入 H5」一节。
- 改管理端或小程序页面时，确认接口字段与后端 DTO / JSON 实际返回一致。
- 涉及认证、活动、球队、球员、账单等核心领域时，优先沿用既有命名与模块边界，不要把业务规则塞进页面层或 handler。
- 后端数据结构变更时注意 legacy 迁移工具（`registration_system_go/scripts/migrate-legacy.sh`、`cmd/migratelegacydb`）与集成测试基建（`internal/testsupport`，每用例独立 schema）是否需要同步调整。

## 常见工作顺序

1. 先定位业务发生在哪个子项目（后端 / 管理端 / 小程序 / 移动 App）。
2. 再确认是否涉及跨项目联动（参考上方「联动规则」对应链路）。
3. 最后在对应子项目内执行最小必要修改和验证。

## 质量要求

- Go 后端提交前执行：`gofmt -w .`、`go test -race ./...`、`go vet ./...`、`go build -o /tmp/registration-system-go-api ./cmd/api`
- 后端集成测试**直连线上测试库**跑（用户约定，不另建本地库）：`TEST_DATABASE_URL` 配在 `registration_system_go/.env`（通常与 `DATABASE_URL` 同库），`make test` 已自动加载 .env。testsupport 为每个用例创建独立随机 schema 并自动 DROP，不会读写业务表；禁止在集成测试里向业务表写入数据。
- Rust 参考后端已从工作区删除，不再有任何验证要求
- Go 配套管理端提交前建议执行：`bun run type-check`、`bun run lint`、`bun run build`
- 小程序提交前建议执行：`bun run type-check`、必要时 `bun run build:mp-weixin`
- 移动管理 App 已暂停开发；若恢复改动，提交前建议执行：`dart format lib test`、`flutter analyze`、`flutter test`、必要时 `flutter build apk --debug`
- 如因环境、依赖、耗时或任务范围原因未运行相关验证命令，必须在最终回复中说明未验证项和原因。
- TDD 规则：后端业务逻辑、仓储、路由等行为变更需要优先考虑 TDD 或补充后端测试；前端不要求每次按 TDD 开发，页面、样式、交互和小程序 UI 变更通常以类型检查、构建和人工/模拟器验证为主。
- 前端测试策略：不要为了普通前端改动机械新增单元测试或静态断言；只有涉及路由、接口调用、权限、数据提交、共享工具函数或关键业务状态变化时，才按风险补充必要测试。
- 前端纯视觉调整（颜色、边框、间距、宽度、字号、圆角、阴影、对齐、遮挡修复等）不要求新增单元测试或静态断言，默认以类型检查、构建和人工/截图验证为准。

## 不要做的事

- 未经用户明确要求，不要大范围重构或随意调整目录结构。
- 不要编写会直接破坏生产数据的迁移、脚本或清库逻辑。
- 不要在回复或文档里暴露真实密钥、连接串、Token；只使用占位符。
- 仓库内未发现 `RTK.md`，不要继续引用一个不存在的文件作为前置依赖。
