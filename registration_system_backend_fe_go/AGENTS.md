# registration_system_backend_fe_go - AGENTS

## 项目定位

对接 `../registration_system_go/` 的新管理后台。技术栈为 React 19、TypeScript、Vite 7、Tailwind CSS 4（CSS-first）、shadcn/ui（new-york / neutral，配合 `radix-ui` 统一包）、reui registry、react-router 7、react-hook-form + zod、React Query 5、dayjs、sonner、Biome、Vitest 和 Bun。视觉风格对齐 `betalpha-admin`（深色默认 + 青绿主色 `#4fc4b3`，可切浅色）。

旧版 `../registration_system_backend_fe/`（Vue 管理后台）已从工作区删除，需要参考时从 git 历史查看；接口、DTO、权限和响应结构以 Go 后端为准。

## 推荐定位顺序

1. 回查 `../registration_system_go/internal/*/adapters/http` 的真实管理端 handler。
2. 更新 `src/types/` 与 `src/api/`。
3. 更新目标页面和路由（`src/router.tsx`）。
4. 执行类型检查、lint、构建和浏览器验证。

## 边界

- Go 统一响应为 `{ code, message, data }`，成功时 `code = 0`。
- 管理端业务接口统一从 `/api/v1/admin` 开始；健康检查位于 `/health`。
- Go 尚未实现的管理端 handler 不在前端臆造请求和 DTO。
- 不沿用旧 Vue 管理端的 `{ success, message, data }` 假设。
- 页面放在 `src/pages/`，请求放在 `src/api/`，布局壳层放在 `src/layout/`，跨页面复用组件放在 `src/components/`。
- UI 组件从 `@/components/ui/*` 导入；图标用 `lucide-react`；不再使用 Ant Design / ProComponents。
- 需要 shadcn 组件用 `bunx shadcn add <name>`；reui 组件用 `bunx shadcn add @reui/<name>`（registry 已配在 `components.json`）。
- 表单统一 react-hook-form + zod + `@/components/ui/form`；注意 `FormField` 依赖 `<Form {...form}>`（FormProvider）包裹。
- 路由与权限在 `src/router.tsx`：页面级 `access` 语义由 `AdminLayout`（登录守卫）与 `RequireSuperAdmin`（超管守卫）承担；会话状态在 `src/features/admin-session/useAdminSession.tsx`。
- 主题（深/浅）通过 `src/theme.ts` 的 `activateTheme` / `useAdminTheme`，存储 key 为 `registration-admin-theme`。
- 环境变量注入走 `import.meta.env`（`envPrefix: ["ADMIN_"]`）：`ADMIN_API_BASE_URL`、`ADMIN_ROUTE_BASE`；不要在浏览器代码里引用 `process.env`。

## 架构三原则：组件化、分层、Design Token

### Design Token（三层）

1. **semantic token**：`src/styles/foundation.css` 的 `:root`（深色默认）/ `.light`（浅色）是全局唯一角色变量定义处（`--background`、`--primary`、`--destructive`、`--surface-*` 等）。**任何样式禁止裸色值与裸像素**，一律 `var(--…)` 引用；新语义色先加 token 再使用。
2. **Tailwind 桥接**：`tokens.css` 的 `@theme inline` 把 semantic token 映射为工具类（`bg-card`、`text-primary`…）；组件内工具类只允许用映射后的名字。
3. **component token**：页面/组件局部变量在使用处就近定义并带作用域前缀（示范：`login.css` 的 `--login-*`、foundation 的 `--control-height`）。不得反向提升为全局 token，也不得跨文件引用他人 component token。

### 样式分层（`src/styles/`，按 @import 顺序，依赖只能向下）

| 文件 | 职责（单一变化原因） |
| --- | --- |
| `tokens.css` | Tailwind @theme 映射，无自有样式 |
| `foundation.css` | semantic token + 元素基线 + reset |
| `primitives.css` | 无业务语义的基础控件外观（table/select/switch…） |
| `feedback.css` | 反馈类：横幅、加载占位、整页结果 |
| `data-display.css` | 数据展示：徽章、状态、详情网格、表格单元格 |
| `form-controls.css` | 表单与操作控件：分页、确认、日期、颜色、选择器 |
| `page-layout.css` | 页面布局骨架：工具条、网格、分区、Sheet（只管结构与间距） |
| `shell.css` | 应用壳层：侧栏、顶栏、工作区 |
| `login.css` | 登录页（component token 示范） |
| `responsive.css` | 响应式覆盖（只放媒体查询） |

新样式先问变化原因再归档；页面专属且量大可建独立文件并在 `src/styles.css` 入口按序注册。分层契约详见 `src/styles.css` 头部注释。

### 组件化（组件分层）

- `components/ui/`：shadcn 基础件（不 import 业务代码）。
- `components/admin/`：跨页面业务组件——`data-table` / `pagination-bar` / `confirm-popover` / `error-alert` / `status-badge` / `detail-grid` / `member-cell`（含 `NameCell`）。新页面**优先复用**这些组件，禁止再手写 `<dl className="detail-grid">`、头像单元格、两行单元格等已被组件化的模式。
- `components/team-members/`、`pages/match-form/`、`pages/team-list/`：按领域内聚的组件族。
- `layout/`：壳层。`features/admin-session/`：会话状态。
- **展示格式化统一走 `src/utils/format.ts`**（`formatDateTime` / `formatCompactDateTime` / `formatNumericDateTime` / `formatDate` / `formatYuan` / `formatYuanAmount`），页面不得自定义 Intl 格式化。
- 页面（`pages/`）只做数据编排与组合，业务规则放 hooks/api 层；新出现的重复 UI 模式（≥3 处）必须抽组件而不是复制类名。

## 常用命令

```bash
bun install
bun run dev          # dev server，/go-api 代理到 API_PROXY_TARGET（默认 127.0.0.1:18080）
bun run type-check
bun run lint
bun run test         # vitest（jsdom，环境见 vite.config.ts test 段）
bun run build        # 根路径构建
bun run build:nginx  # /registration-admin/ 子路径
bun run build:out109 # /regist-admin-v3/ 子路径 + 外网 API base
```

## 验证

提交前执行 `bun run type-check`、`bun run lint`、`bun run build`，页面变更通过桌面与移动视口人工或截图验证；登录入口体积预算用 `bun run perf:budget`（gzip ≤ 220KB，从 Vite manifest 递归收集入口资源）。

## e2e

Playwright spec 在 `e2e/`。选择器基于 role / label / 语义类名（如 `.status-filter`、`.team-select-label`、`[data-slot='card-title']`），不要引入组件库私有类名。
