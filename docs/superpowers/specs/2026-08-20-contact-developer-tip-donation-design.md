# 设计：联系开发者 + 请喝咖啡打赏

- 日期：2026-08-20
- 状态：已与产品负责人确认设计方向，待实施
- 涉及子项目：`registration_system_mini`（小程序/H5）、`registration_system_go`（后端）、`registration_system_backend_fe_go`（Go 管理端）

## 1. 背景与目标

小程序需要一条用户与开发者（产品负责人）建立联系的通道，并允许用户以"请喝咖啡"的方式对开发者进行任意金额打赏；打赏时可附带一条可选的功能建议，建议只有在打赏支付成功后才生效提交（携带用户 ID 与昵称）。开发者需要在 Go 管理端查看打赏记录与建议内容。

明确不做：不做会员/钱包账户变动（打赏不是充值）、不做建议的独立反馈系统（建议随打赏提交，不单独收集）、不改既有支付链路行为。

## 2. 已确认的产品决策

| 决策点 | 结论 |
| --- | --- |
| "我的"页"账户与服务"区块 | 只换入口位置：该位置换成"联系开发者"入口；球队信用展示 + 球队会员续费**保留**，区块下移并改标题为"球队服务" |
| 管理端可见性 | 新增"打赏与建议"列表页（金额、用户昵称/ID、建议内容、支付时间、订单号） |
| 建议提交时机 | 支付成功才生效：建议随下单落库（未生效态），微信回调确认支付后置为已生效 |
| 打赏金额限制 | 不设范围上限，仅要求为正数（1 分起，微信支付下限）；曾限制 1000 元已按产品决策移除 |
| 审核模式（`shouldHideCreationEntrances`） | 隐藏打赏卡片，仅展示双二维码（规避小程序审核对打赏类目的风险） |

## 3. 技术路线

**复用现有支付链路，新增 `tip` 订单类型**（`internal/payment` 模块，六边形分层不变）。不建独立支付模块。

理由：微信支付 V2 网关（验收环境 `WECHAT_PAY_USE_MOCK=false`，真实商户号）、订单状态机（pending → paid/cancelled/failed，幂等）、回调验签、sync 主动查单兜底、mock 网关测试约定（`paySign == "mock_sign_for_testing"`）全部直接复用；`match_registration`（迁移 00017）是新增订单类型的成熟先例。独立模块需重复约 80% 支付基础设施，且订单视图割裂。

已知实现风险：`internal/payment/application/service.go` 的 `settleVerified` 按订单 `Kind` 路由结算，**default 分支会落入 `CreditRecharge`（充值入钱包）**。tip 订单必须显式新增 case，否则打赏款会被错误充进用户钱包。

## 4. 小程序端设计（`registration_system_mini`）

### 4.1 "我的"页面（`src/pages/user/index.vue`）

- 原 `MineServiceGrid` 位置（`MineWalletSection` 之后）替换为**"联系开发者"入口行**：样式与现有"设置"入口一致（一行卡片 + 右侧箭头），点击 `uni.navigateTo` 到 `/pages/user/contact-developer/index`；对全部登录用户可见。
- `MineServiceGrid`（`src/pages/user/components/MineServiceGrid.vue`）下移到联系开发者入口之后、设置入口之前；标题"账户与服务"改为"球队服务"，props/事件/功能不变。

### 4.2 联系开发者二级页面（新增 `src/pages/user/contact-developer/index.vue`）

页面自上而下三个区块：

1. **双二维码区**：开发者微信二维码（`https://oryjk.cn:82/registration/venue/contact-qrcode.jpg`）与公众号二维码（`https://oryjk.cn:82/registration/venue/official-account-qrcode.jpg`）并排，各带说明文字（"加开发者微信" / "关注公众号"）。两张码各自独立 `<image>` 并加 `show-menu-by-longpress`（合成长图微信无法长按识别）。二维码 URL 收敛到常量文件（从 `matchCreationAccess.ts` 抽出复用，不复制字面量）。
2. **"请开发者喝咖啡"打赏卡片**（审核模式下整卡隐藏）：
   - 感谢话术（文案草稿："如果这个小程序帮到了你，可以请开发者喝杯咖啡。你的支持是我持续迭代的动力，也欢迎顺手写下你希望拥有的功能。"— 实施时可在 PR 里微调）。
   - 金额输入：元为单位自由输入，不设上限，仅校验为正数（`金额 > 0`，最多两位小数）。
   - 功能建议输入：可选 textarea，placeholder 引导（"希望小程序有什么功能？可不填"），上限 500 字。
   - 主按钮"请喝咖啡"：登录态校验（未登录引导登录）→ 金额校验 → 调下单接口 → `requestWxPayment` 拉起支付 → 成功显示感谢反馈（neo 弹窗或成功态卡片），用户取消提示且不报错（复用 `isPaymentCancelled`）。
   - mock 支付兼容：识别 `MOCK_PAY_SIGN` 跳过真实拉起并调用 sync 入账（沿用现有钱包/会员支付的前端模式）。
3. 页面遵循现有分层约定：页面 SFC 只做编排，下单/支付动作抽到局部 `*Actions.ts` 或 composable，API 封装放 `src/api/`。

### 4.3 新增 API 封装（`src/api/payment.ts` 或就近域文件）

- `createTipOrder(params: { amountCents: number; suggestion?: string })` → 返回既有 `GoPaymentOrderResult`（`{ order: { order_no, ... }, payment: {...} }`，与后端 `{order, payment}` 契约一致）；支付参数经 `normalizeWxPaymentParams` 归一后交给 `requestWxPayment`。
- 金额"元 ↔ 分"换算工具收敛到单一函数，避免散落 `* 100`。

## 5. 后端设计（`registration_system_go`）

### 5.1 数据库迁移（`db/migrations/00019_tip.sql`，暂名）

1. `payment_orders.kind` 的 CHECK 约束重建：drop + add，**保留全部既有值**（`recharge` / `team_membership` / `match_registration`）再加入 `tip`（照 00017 先例；kind 列已是 VARCHAR(32)）；不触碰 `payment_orders_match_shape_check`（tip 无 match_id/team_id，天然满足）。
2. 新表 `tips`：

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL PK | |
| `order_no` | VARCHAR(32) NOT NULL UNIQUE | FK → `payment_orders(order_no)` |
| `user_id` | BIGINT NOT NULL | FK → `users(id)` |
| `nickname` | VARCHAR(120) NOT NULL DEFAULT '' | 下单时快照，回调路径无登录态 |
| `amount_cents` | BIGINT NOT NULL | 与订单一致 |
| `suggestion` | TEXT NOT NULL DEFAULT '' | 可选功能建议，≤500 字 |
| `status` | VARCHAR(16) NOT NULL | `pending` → `submitted`（submitted = 支付成功、建议已生效，非"待审核"） |

订单 cancel/failed 时 `tips` 行停留在 `pending` 属预期，无需清理任务；管理端列表只取 `status = 'submitted'`。
| `created_at` / `submitted_at` | TIMESTAMPTZ | |

同步 `db/queries/payment.sql` 与 sqlc 生成、legacy 迁移工具核对（无 legacy 对应，无需改 `migrate-legacy.sh`）。

### 5.2 领域层（`internal/payment/domain/order.go`）

- 新增 `KindTip Kind = "tip"`。
- `NewTipOrder(userID, amountCents, now)`：金额校验 `1 ≤ amount ≤ 100_000`（分）；`TipMaxAmountCents = 100_000` 常量。无 TeamID/MatchID。

### 5.3 应用层（`internal/payment/application/service.go`，TDD）

- `CreateTip(ctx, userID, amountCents, suggestion)`：
  1. 生成订单号、构造 `NewTipOrder`、落库 pending；
  2. 读取用户昵称快照（**扩展现有 users 只读端口**：`internal/payment/ports/ports.go` 的 `UserOpenIDReader` 旁新增 `NicknameForUser(ctx, userID)`，由 users 仓储适配实现），写入 `tips`（status=pending）；
  3. 取 openid → `gateway.UnifiedOrder` → `SavePrepared` → 返回 JSAPI 支付参数（复用 recharge 的编排形态）。
- `settleVerified` 新增 `KindTip` case：事务内 MarkPaid + `tips.status → submitted`（幂等：订单已 paid 时跳过）。结算实现放 postgres 仓储（照 `ApplyRegistrationPayment` 模式：FOR UPDATE + 金额校验 + kind 校验）。
- 建议文本不参与签名/支付描述（微信 body 用固定"请开发者喝咖啡"）。

### 5.4 HTTP 层（`internal/payment/adapters/http/handler.go`）

| 路由 | 鉴权 | 请求 | 响应 |
| --- | --- | --- | --- |
| `POST /api/v1/app/payments/tip-orders` | 用户 JWT | `{ amount_cents: int, suggestion?: string(≤500) }` | `{ order: { order_no, ... }, payment: { timeStamp, ... } }` —— **完全复用 recharge 的 `CreateRechargeResponse` 结构**（`{order, payment}` 两段），小程序端沿用既有 `GoPaymentOrderResult` 类型解析 |
| `GET /api/v1/admin/payments/tips` | 管理员 JWT | 分页（按 `submitted_at` 倒序） | 已支付打赏列表：order_no、user_id、nickname、amount_cents、suggestion、submitted_at |

支付回调复用现有 `POST /api/v1/webhooks/wechat-pay`，无需新回调路由；sync 兜底接口对 tip 订单同样适用。

### 5.5 测试（TDD）

- 领域：金额边界（1 分 / 100_000 分 / 越界拒绝）。
- 应用：CreateTip 编排（订单 + tips 落库 + 网关参数）、settleVerified 的 tip case（含"tip 订单绝不能落入 CreditRecharge"的回归断言）、幂等（重复回调不重复置 submitted）。
- 仓储：`internal/testsupport` 独立 schema 集成测试（下单 → 模拟回调 → tips 状态与订单状态一致）。
- HTTP：路由注册、鉴权、DTO 校验（suggestion 超长 400）。

## 6. Go 管理端设计（`registration_system_backend_fe_go`）

- 新增"打赏与建议"页面（菜单入口命名随现有后台导航风格）：分页表格列 = 支付时间、用户昵称（+ID）、金额（元）、功能建议（长文本截断 + 详情展开）、订单号。
- API 封装放 `src/api/`，遵循 `ApiResponse<T>` 契约。
- 不改既有订单列表页（tip 订单会自然出现在通用订单列表，属预期）。

## 7. 兼容性

- 全部变更为**新增**：新路由、新表、新 kind 值、新字段，不删除/改名既有路由与字段，不影响已发布小程序的既有调用 → 满足工作区兼容性硬规则。
- `payment_orders.kind` CHECK 扩展是放宽，旧数据不受影响。

## 8. 验证清单

- 后端：`gofmt -w .`、`go test -race ./...`、`go vet ./...`、`go build -o /tmp/registration-system-go-api ./cmd/api`。
- 小程序：`bun run type-check`、`bun run build:mp-weixin`（含组件注册检查）。
- 管理端：`bun run type-check`、`bun run lint`、`bun run build`。
- 真机验收（验收环境，真实商户号）：0.01 元打赏全流程 + 建议落库 + 管理端可见；支付取消不产生已生效建议；审核模式下打赏卡片隐藏。

## 9. 实施顺序（单计划内）

1. 后端迁移 + 领域 + 应用 + 仓储（TDD）→ HTTP 路由与测试。
2. 小程序：API 封装 → 联系开发者页面（含 `src/pages.json` 注册 `/pages/user/contact-developer/index`）→ "我的"页面入口调整。
3. 管理端：API + 打赏与建议页面。
4. 全量验证 + 验收环境部署 + 真机支付测试。
