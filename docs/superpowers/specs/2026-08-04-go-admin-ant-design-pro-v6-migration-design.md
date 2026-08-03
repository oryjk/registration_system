# Go 管理后台 Ant Design Pro v6 完整迁移设计

## 背景

`registration_system_backend_fe_go/` 是对接 Go 新后端的管理后台，目前尚未发布上线。现有项目使用 React 19、Vite、React Router、Ant Design 5.29.3 和 `@ant-design/pro-components` 2.8.10，但 ProComponents 尚未进入页面实现，页面主要由 Ant Design 基础组件与全局 CSS 组成。

Ant Design Pro v6 不是单一依赖版本，而是一套完整的中后台应用架构。官方 v6 发布说明包含 React 19、Ant Design 6、ProComponents 3、Umi Max 4、utoopack、Tailwind CSS 4、antd-style 4、React Query 和 Biome，并建议通过新建 v6 项目逐步迁移业务代码。

本次迁移以官方 Ant Design Pro `v6.0.2` 精简模板为基线，将基础设施迁入现有目录，再迁移现有业务。项目目录、Go 后端契约、访问路径和部署路径保持不变。

本设计取代 `2026-07-15-go-admin-procomponents-visual-redesign.md` 中“保留 Vite、Ant Design 5 和 React Router”的技术决策。旧文档仅作为历史记录。

## 目标

- 将 Go 管理后台完整迁移到 Ant Design Pro v6 架构。
- 使用 Umi Max 4 管理路由、布局、初始化状态、权限、请求和 React Query。
- 使用 antd 6、ProComponents 3、CSS Variables、Tailwind CSS 4 和 antd-style 4 建立一致的运营后台设计语言。
- 保留现有管理员认证、权限规则、API DTO、业务行为和可访问 URL。
- 保留深绿色品牌方向和紧凑、克制、高信息密度的赛事运营台风格。
- 保留 Bun 的依赖安装体验，同时以 Node.js 20+ 运行 Umi 生态，以 utoopack 构建。
- 集成 Ant Design CLI skill 与 MCP，让后续 Codex 工作能够查询精确版本的组件 API、Token、语义结构和迁移信息。
- 在桌面与移动视口完成类型、静态检查、构建和关键业务流程验证。

## 非目标

- 不修改 Go 后端、数据库、API 路径、DTO 或权限规则。
- 不保留 Ant Design Pro 的演示页面、AI 助手、图表、地图、Cloudflare Worker、Mock API 或 OpenAPI 示例。
- 不引入未由现有 Go 接口支持的统计指标或业务功能。
- 不兼容旧 Vite 插件、React Router API 或 Ant Design 5 专属补丁。
- 不迁移旧 Vue 管理端，也不修改 Rust 参考后端。
- 不为了框架迁移重构无关业务逻辑。

## 版本与工具链基线

迁移以 Ant Design Pro `v6.0.2` tag 的精简模板为结构基线。基础版本以模板的 `package.json` 和新生成的 Bun 锁文件为准，至少包括：

- Node.js `>=20.0.0`
- React 19
- `antd` 6
- `@ant-design/icons` 6
- `@ant-design/pro-components` 3
- `@umijs/max` 4
- `@tanstack/react-query` 5
- `antd-style` 4
- Tailwind CSS 4
- Biome 2
- TypeScript 6
- `@ant-design/cli` 6.5.3

Bun 继续负责依赖安装、锁文件和项目脚本入口。Umi Max 及模板中的 Node 脚本在 Node.js 20+ 环境运行；开发和生产构建由 Umi 的 utoopack 配置完成。不得以 Bun 原生兼容性为理由移除 Node 运行前提。

只保留业务实际使用的模板依赖。删除 AI、图表、D3、Markdown、Cloudflare Worker、Mock 和 OpenAPI 示例所需的依赖与配置。

## 迁移策略

1. 在工作区外的临时目录检出官方 `v6.0.2`，安装依赖并执行 `simple`，得到可核对的最小模板。
2. 将模板基础设施有选择地迁入现有 `registration_system_backend_fe_go/`，不直接用目录覆盖命令覆盖现有业务。
3. 先建立能够启动和构建的 Umi 外壳，再迁移认证、请求与权限。
4. 按页面族迁移业务页面，并在每一阶段保持类型检查和构建可执行。
5. 删除已经失效的 Vite、React Router、ESLint 和 antd 5 文件及依赖。
6. 完成 Ant Design MCP、静态分析、E2E 和桌面/移动视觉验证。

临时模板只用于比对，不进入仓库。最终代码仍位于现有子项目目录，保留该目录的 Git 历史和部署入口。

## 目标架构

```text
config/config.ts
  |-- Umi Max / utoopack / publicPath / proxy
  |-- antd 6 cssVar / locale / theme
  |-- initialState / access / request / reactQuery / layout
  v
src/app.tsx ------------------------ 全局运行时配置与错误边界
  |-- getInitialState() ------------ Token 恢复与当前管理员
  |-- layout() --------------------- ProLayout 品牌、菜单、账号与退出
  |-- request ---------------------- 请求错误适配
  v
src/access.ts ---------------------- 登录态与超级管理员权限
  v
config/routes.ts ------------------- 固定 URL、权限和懒加载边界
  v
src/pages/* ------------------------ PageContainer / ProTable / ProForm
  |
  +-- src/hooks/queries/* ----------- React Query 查询与失效规则
  +-- src/api/* --------------------- 纯 API 调用与响应解包
  +-- src/types/* ------------------- Go DTO 对应类型
```

### 配置边界

`config/config.ts` 只管理框架与构建配置，不包含页面业务判断。必须配置：

- `hash` 和 utoopack。
- 中文 locale。
- antd `cssVar`、filled 表单风格与品牌 Token。
- `initialState`、`access`、`layout`、`request` 和 `reactQuery` 插件。
- 开发代理 `/go-api` 到 `API_PROXY_TARGET`，默认 `http://127.0.0.1:18080`。
- 默认根路径开发构建与 `/registration-admin/` Nginx 构建。
- 路由预加载和稳定的构建产物 hash。

配置不启用模板 Mock、OpenAPI、analytics、AI、Markdown loader、演示 API 或 Cloudflare Worker。

### 路由边界

`config/routes.ts` 保留以下 URL：

- `/login`
- `/`
- `/matches`
- `/matches/new`
- `/matches/:id`
- `/matches/:id/edit`
- `/teams`
- `/admins`
- `/access`
- `/403`
- `/404`

受保护页面由 Umi access 规则统一拦截。`/admins` 同时要求超级管理员权限。未知路径进入 404。迁移后不再并存 React Router 的 `<Routes>`、`Navigate`、`Outlet` 或 `NavLink`。

## 认证与权限

现有 Local Storage key `registration-admin-go.token.v1` 保持不变，避免本地联调状态无故失效。

`getInitialState()` 的职责：

1. 无 Token 且不在登录页时，返回未认证状态。
2. 有 Token 时调用现有 `/api/admin/auth/me`。
3. 成功后返回当前管理员。
4. 401、Token 无效或用户加载失败时清除 Token 并返回未认证状态。

登录页继续调用 `/api/admin/auth/login`。成功后写入 Token、更新 Umi initial state，再跳转到登录前目标 URL 或首页。退出登录清除 Token、清空查询缓存和 initial state，再跳转 `/login`。

`src/access.ts` 只从 initial state 派生：

- `isAuthenticated`
- `isSuperAdmin`

前端权限用于路由和操作可见性，不代替后端授权。401 统一清理认证并跳转登录；403 保留独立页面语义。

## 请求与服务端状态

`src/api/client.ts` 继续是 Go API 协议适配边界：

- 管理端请求统一添加 `/api/admin` 前缀。
- 自动附加 Bearer Token。
- 严格解析 `{ code, message, data }`，仅 `code = 0` 视为成功。
- 保留 `ApiError` 的 HTTP status、业务 code 和真实 message。
- 401 触发统一认证过期流程。

业务 API 函数继续位于 `src/api/`，不在页面直接拼 URL 或解析响应。

React Query 位于 API 函数之上：

- 查询 key 按领域和参数稳定构造。
- 比赛列表使用服务端分页参数作为 key。
- 球队和管理员沿用后端当前的全量列表能力，不伪造分页接口。
- 创建、编辑、取消、删除成功后只失效受影响的查询。
- 表单提交等一次性命令可直接使用 mutation，不把编辑状态放入全局缓存。

页面只编排 loading、data、error、筛选和操作，不复制认证、请求解包或查询失效逻辑。

## 布局与视觉系统

### ProLayout

删除自建 `AppShell` 的 Layout、Sider、Drawer 和 Menu 实现，改用 Umi layout 插件与 ProLayout runtime 配置。保留：

- “开踢管理台”品牌名称与 `KT` 标识。
- 系统概览、比赛管理、球队管理、场馆管理员、接入状态导航。
- 超级管理员菜单条件。
- 当前管理员账号与退出入口。
- 桌面折叠与移动抽屉行为。

ProLayout 负责导航和响应式框架，业务页面不感知侧栏状态。

### 主题

主题通过 antd 6 Design Token、CSS Variables 和 antd-style 管理：

- 深绿色作为品牌主色与导航基色。
- 中性浅灰绿作为页面背景。
- 白色作为主要内容面。
- 荧光黄仅用于有限的品牌强调，不覆盖成功、警告、错误等语义色。
- 圆角不超过 8px，控件和表格保持紧凑密度。
- 中文为主要界面语言，删除无业务意义的英文装饰文字。

Tailwind 4 仅用于清晰的页面布局、间距和响应式规则；组件外观优先使用 antd Token、ProComponents props 和 antd-style。不得通过宽泛 `.ant-*` 选择器依赖内部 DOM。

## 页面组件映射

### 登录页

- 使用 ProComponents 登录表单能力或等价的 ProForm 字段。
- 保留账号、密码、错误提示、提交 loading 和登录后返回原路径。
- 保持深绿品牌面与紧凑表单，不引入模板宣传内容。

### 系统概览

- 使用 `PageContainer` 和可由现有健康、比赛、球队接口真实得到的数据。
- 不显示模板图表、趋势、销售额或虚构统计。
- API 技术细节继续放在接入状态页。

### 比赛列表与详情

- 比赛列表使用 `ProTable` request 模式和真实服务端分页。
- 关键词、状态、页码和页大小同步到 URL。
- 查看、编辑、取消、永久删除的权限、确认和 payload 保持不变。
- 详情使用 `PageContainer`、状态摘要、Descriptions 和报名组 ProTable。

### 比赛表单

- 独立的新建与编辑路由继续共用一个页面。
- 使用 ProForm 字段表达比赛模式、主客队、人数、时间、地点和坐标。
- 保留条件字段、球队搜索、快速创建、日期序列化、坐标校验和提交确认。

### 球队与成员管理

- 球队列表使用本地数据源 ProTable，因为当前 API 返回全量列表。
- 创建与编辑使用 `ModalForm`，详情和成员管理使用 Drawer/DrawerForm 或明确分区。
- 保留成员资料编辑、加入/移除成员、设置/取消队长及相关限制。
- 业务状态与操作颜色使用语义 Token，不只依赖颜色区分。

### 场馆管理员与接入状态

- 管理员列表使用本地数据源 ProTable，创建使用 `ModalForm`。
- 保留超级管理员限制、密码确认和现有 payload。
- 接入状态页保留当前管理员、认证和 API 契约信息，统一使用 PageContainer。

## 错误、加载与空状态

- 路由级加载使用稳定的全页加载状态。
- 查询失败使用页面级 Alert/Result，提供明确重试动作。
- 字段校验错误显示在对应字段附近。
- 创建、编辑、取消和删除使用 `App.useApp()` 提供成功或失败反馈。
- 破坏性操作继续二次确认。
- 空列表使用 ProTable/Empty 的正式空状态，不显示虚构示例数据。
- 未捕获运行时异常进入统一错误边界，不显示空白页。
- 401、403、404 和普通业务错误保持不同语义。

## MCP 与 Agent 集成

Ant Design CLI skill 保存在目标子项目的 `.agents/skills/antd/`，目标子项目 `AGENTS.md` 包含受管理的使用说明。

仓库根目录新增 `.codex/config.toml`，使可信项目中的 Codex App、CLI 和 IDE 扩展共享 Ant Design MCP。配置使用 STDIO：

```toml
[mcp_servers.antd]
command = "bunx"
args = ["@ant-design/cli@6.5.3", "mcp", "--version", "6.4.3", "--lang", "zh"]
startup_timeout_sec = 30
```

实现时以最终安装的 antd 6 精确版本更新 `--version`，不得保留错误的 5.x 固定值。配置完成后使用 `codex mcp list` 和实际 MCP 初始化验证；Codex 客户端需要刷新或重启后才会加载新服务器。

## 构建与部署兼容

保留等价脚本：

- `bun run dev`：本地开发，默认通过 `/go-api` 代理 `127.0.0.1:18080`。
- `bun run type-check`：TypeScript 无输出检查。
- `bun run lint`：Biome 检查。
- `bun run build`：根路径生产构建。
- `bun run build:nginx`：以 `/registration-admin/` 为 publicPath 构建。
- `bun run test:e2e`：Playwright 关键流程。

Umi 环境配置代替 `import.meta.env`。API base URL 必须支持开发代理和显式环境变量，不把生产地址写死进源码。

构建产物继续输出到 `dist/`。现有 Nginx 部署路径和 Go API 路由不变。

## 测试与验收

### 静态与构建检查

- `bun install`
- `bun run type-check`
- `bun run lint`
- `bun run build`
- `bun run build:nginx`
- `bunx @ant-design/cli@6.5.3 doctor --format json`
- `bunx @ant-design/cli@6.5.3 usage ./src --format json`
- `bunx @ant-design/cli@6.5.3 lint ./src --format json`
- `git diff --check`

### E2E 行为

迁移并运行现有 Playwright 流程，至少覆盖：

- 登录、Token 恢复、退出和登录后回跳。
- 比赛列表、详情、取消和永久删除。
- 比赛新建与编辑关键字段。
- 球队创建、编辑、查看、删除。
- 球队成员资料、成员与队长管理。
- 超级管理员创建场馆管理员。
- 非超级管理员的权限限制。
- 404 和认证过期。

测试继续验证真实请求路径和 payload，不能仅验证静态页面文字。

### 视觉与运行时

在 `1440x1000` 和 `390x844` 视口检查登录、系统概览、比赛、球队、管理员和接入状态页面：

- 无空白画布、横向溢出、文字遮挡或操作不可达。
- ProLayout 桌面折叠和移动抽屉正常。
- 表格列在移动端合理收敛。
- Modal、Drawer、日期和选择控件不超出视口。
- 浏览器控制台没有未捕获异常，关键请求没有路径回归。

## 删除项

迁移完成后删除：

- `vite.config.ts`、`index.html` 和 Vite 类型声明。
- `react-router-dom` 及 React Router 专属入口代码。
- `@ant-design/v5-patch-for-react-19`。
- ESLint 配置与依赖，由 Biome 接管。
- 旧的自建 AppShell 与已被 ProLayout 替代的全局 CSS。
- Ant Design Pro 模板演示页、Mock、AI、图表、地图、Cloudflare Worker 和无关文档。
- 迁移过程中的临时模板与一次性脚本。

删除前必须通过搜索确认没有剩余引用。

## 实施顺序

1. 获取并精简官方模板，建立版本清单和迁移基线。
2. 替换构建、TypeScript、Biome、Tailwind 和 Umi 配置。
3. 建立路由、主题、ProLayout、MCP 和最小可运行外壳。
4. 迁移 Token、请求客户端、initial state、access 与 React Query。
5. 迁移登录、系统概览和接入状态。
6. 迁移比赛列表、表单和详情。
7. 迁移球队、成员和场馆管理员页面。
8. 迁移并增强 E2E，删除旧栈残留。
9. 执行完整静态、构建、MCP、E2E 和视觉验收。

## 风险控制

- 官方模板仅作受控基线，不覆盖现有业务文件和用户工作区变更。
- 先迁移协议与权限边界，再迁移页面，避免 UI 能渲染但认证或请求语义变化。
- 保持现有路由和 API payload，Playwright 对请求路径与 payload 做回归验证。
- ProComponents v3 API 必须通过安装后的类型定义和 Ant Design CLI 核对，不依赖旧 v2 经验。
- Umi publicPath、history 和 Nginx fallback 必须同时验证根路径与子路径构建。
- 每个页面族迁移后立即执行类型检查和构建，避免最后集中暴露跨框架错误。
- 迁移不保留双路由、双请求客户端或双状态容器等长期兼容层。

## 完成标准

只有同时满足以下条件才视为完成：

- 目标目录已经使用 Umi Max 4、antd 6、ProComponents 3、React Query、Tailwind 4、antd-style 4、Biome 和 utoopack。
- Vite、React Router、antd v5 patch、ESLint 和模板演示代码已移除。
- 原有 URL、API、DTO、认证、权限、业务操作和 Nginx 部署路径保持可用。
- Ant Design CLI skill 与项目级 MCP 配置存在，并通过可执行检查。
- 类型检查、lint、两种生产构建和适用的 Playwright 流程通过。
- 桌面与移动截图及控制台检查证明主要页面可用且设计语言一致。
