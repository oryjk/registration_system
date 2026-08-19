# 散人约球一人代多人报名设计（人数选择 + 费用按人数倍数）

- 日期：2026-08-19
- 状态：已与需求方确认（方案 A：效开现有 `registration_count` 字段；已支付后禁止修改与取消；人数上限仅受剩余名额约束）
- 涉及：`registration_system_go`、`registration_system_mini`、`registration_system_backend_fe_go`
- 明确不涉及：`registration_system_admin_app`（Flutter，已暂停）

## 背景与问题

- 散人约球（`online_pickup`）当前一次报名只能报 1 人：`user_registration_service.go` 校验 `registration_count != 1` 直接拒绝、新建报名硬编码 1、`ApplyUserStatus` 会把人数重置为 1，三处闸口把人数锁死。
- 用户实际场景是"帮朋友一起报名"：一人代 N 人占位，费用相应为 N 份。数据库 `match_registrations.registration_count` 字段（legacy 迁移即有）、领域模型 `Registration.RegistrationCount`、容量统计 `SUM(registration_count)`、请求/响应 DTO 均已天然支持 count>1，只是应用层不放行。
- 报名费金额恒为 `fee_per_person_cents × 1`（`registration_fee_service.go`），订单请求体只有 `match_id`，金额由后端按单人定价。

## 目标

1. 散人约球报名时可选人数 N（含报名者自己），容量、成行人数、统计都按人头计。
2. 赛前支付金额 = N × 人均费用；支付流程（下单 → 微信支付 → 回调核销标记 paid）不变。
3. 锁定规则：未支付可调整人数/取消；已支付禁止调整人数与取消（无退款能力，费用问题线下协商）。
4. 小程序与管理端名册能看出"该行报了 N 人、是否已支付"。

## 非目标（明确不做）

- 不做退款（微信退款 API 未集成）；不支持"已付后加人补差价"。
- 不记录被代报朋友的身份（无参与者明细表、无姓名登记）。
- 不改 `online_individual`（约对手）散人组与球队组的出勤语义，两者人数仍必须为 1。
- 不改数据库结构（`registration_count` 列已存在，无新迁移）。
- 不触碰 legacy 迁移工具（`normalizeRegistrationCount` 本就归一化任意正数）与小程序 legacy 挑战链路（`challenges/detail.vue`）。

## 产品规则

- 适用范围：仅 `match.publication_mode = online_pickup` 且分组为散人组（`individual_opponent`）时允许 `registration_count > 1`；其余场景一律要求 = 1（报错口径不变）。
- 人数边界：1 ≤ N ≤ 剩余名额（`max_players - 当前 attending 人数和`），不设固定上限。
- 费用：prepaid 且人均费用 > 0 时，应付 = N × 人均费用；免费场 / postpaid 无支付环节。
- 状态迁移：
  - 未支付：重新提交（PUT）可改人数（容量按新人数重算），DELETE 取消整单（N 个名额一起释放）。
  - 已支付：PUT 变更人数或状态 → 拒绝；DELETE → 拒绝。完全相同的幂等提交（同状态同人数）仍放行。
  - 散人组仍只允许 `attending` 状态（现状不变）。

## API 契约（Go 后端）

- `PUT /api/v1/app/matches/:id/groups/:group_id/my-registration`：请求体不变（`{status, registration_count}`），语义放开——散人约球组 `registration_count` 可为 >1 的正整数；非散人约球组传 >1 返回 400（"报名人数必须为 1"）。
- `DELETE` 同路径：已支付报名返回错误"已支付的报名不可取消"（HTTP 状态码沿用 match 模块现有错误映射风格，计划阶段定）。
- `POST /api/v1/app/payments/match-registration-orders`：请求体不变（`{match_id}`）；订单金额改为 N × 人均费用（按该用户当前活跃 attending 报名的人数定价）；创建新订单前自动关闭同比赛同用户遗留的未支付旧订单。
- 详情/名册透出：
  - 用户端 `GET /matches/:id`：`participants[]` 增加 `registration_count`（前端显示"带 N 人"）；`my_registration` 已有 `registration_count` / `paid`，不变。
  - 管理端 `GET /api/v1/admin/matches/:id`：名册条目 `registrations[]` 增加 `registration_count`、`paid`。
- `docs/openapi.yaml` 同步字段与描述；无新增端点，`openapi_test.go` 的 documented operations 数量不变。

## Go 后端设计

分层沿用六边形结构，改动集中在 match 模块 + payment 下单入口：

- **领域**（`internal/match/domain/registration.go`）：
  - `ApplyUserStatus` 不再把 `RegistrationCount` 重置为 1：签名增加目标 count 参数（调用点在 `user_registration_service.go` 内，同步修改），人数作为报名记录的可变更属性由应用层显式传入。
  - `NewRegistration` 已支持任意 count，不动。
- **应用服务**（`internal/match/application/user_registration_service.go`）：
  - 基础校验放宽为 `count >= 1`；"仅散人约球可 >1"的判断在加载 match/group 之后做（`match.PublicationMode == OnlinePickup && group.Kind == GroupIndividualOpponent`，否则要求 = 1）。
  - 幂等短路从"同状态且 count==1"改为"同状态且同人数且未取消"。
  - 已付锁定：`found.Paid == true` 时，任何状态或人数变化返回错误"已支付的报名不可修改"；幂等同值提交放行。
  - 容量投影：`projected += command.RegistrationCount`（替换固定 +1），减去当前记录的 count 逻辑不变；超员报错文案带剩余名额（如"报名人数超过剩余名额（剩 N）"）。
  - `Delete`：已支付 → 报"已支付的报名不可取消"。
- **费用**（`internal/match/application/registration_fee_service.go`）：
  - 返回金额 = `fee_per_person_cents × registration.RegistrationCount`（取该用户该比赛唯一活跃 attending 记录的人数）。
- **支付**（`internal/payment/`）：
  - `application/service.go` `CreateMatchRegistration`：取到费用后、创建订单前，关闭同 `match_id + user_id + kind=match_registration` 的 pending 订单（新增 sqlc 查询如 `CancelPendingMatchRegistrationOrders`，与建单同事务），防止改人数后旧金额订单被误付。
  - 订单金额沿用费用端口返回值；`NewMatchRegistrationOrder` 的 1 万元上限校验已存在，多人合计触顶时按现有错误返回。
  - 核销 `ApplyRegistrationPayment`（按 match+user 标 paid）不变。
- **DTO/端口**：
  - `ports.UserParticipant` 增加 `RegistrationCount`；`adapters/http/user_handler.go` `UserParticipantResponse` 透出。
  - `ports.AdminRosterEntry` 增加 `RegistrationCount`、`Paid`；`admin_handler.go` `RegistrationEntryResponse` 透出。
  - `adapters/postgres/repository_registration.go`（admin 名册）与 `repository_detail.go`（用户端 participants）从 `ListGroupRegistrations` 结果映射这两个字段（SQL 已返回 `r.*`，无需新查询）。

## 小程序设计（registration_system_mini）

- **API**：`src/api/match.ts` `putMyMatchRegistration` 增加 count 参数（替换硬编码 1）；`src/types/match.ts` `AppMatchParticipant` 增加 `registration_count`；`detailData.ts` participants 转换不再写死 1，`joinedCount` 改用后端 `attending_count`（按人头求和）而非数参与者行数。
- **报名交互**：点"立即报名"不再走纯文本确认弹窗，改为弹出报名面板（新组件，底部弹层样式参照 `PublishTypeSheet`，视觉语言对齐 `TeamRegistrationFormCard`）：
  - 人数选择器（`wd-input-number` 步进器，可选范围 1 – 剩余名额）；
  - prepaid 场景实时显示"合计 ¥单价 × N"，免费场显示"免费"；
  - 确认后提交报名，prepaid 紧接着拉起支付（金额为合计，`useMatchRegistrationPayment` 的待付金额标签按人数计算）。
- **已报未付**：状态卡显示"已报 N 人 · 待支付 ¥合计"，提供"调整人数"（复用同一面板，预填当前人数，未付可改）与"取消报名"入口；本地乐观 patch 按人数差值更新。
- **已支付**：只读展示"已报 N 人 · 已支付"，隐藏修改/取消入口（后端有兜底校验）。
- **名册展示**：参与者列表显示"张三（带 2 人）"；头像区维持按用户一行。
- **mock**：`handlers.ts` 报名接口已透传 count，支付订单 mock 金额改为按报名人数 × 单价计算；`getMockMatchDetail` 的人数真实化；更新断言 `registration_count: 1` 的既有测试（`matchApi.test.ts` 等）。

## Go 管理端设计（registration_system_backend_fe_go）

- `src/api/matches.ts`：名册条目类型补 `registration_count`、`paid`。
- `src/pages/MatchDetailPage.tsx`：名册列表每行显示人数（"×N"，N=1 时省略）与支付状态标记（已付/未付）。

## 测试与验证

- Go（TDD）：
  - `user_registration_service` 单测：散人约球 count>1 成功、容量按人头投影（含调整人数）、超员报错带剩余名额、非 pickup 场景 count>1 拒绝、已付锁定（改人数/改状态/取消均拒绝、幂等同值放行）。
  - `registration_fee_service` 单测：金额 = 单价 × N；已付拒绝重复支付不变。
  - payment 集成/单测：订单金额含人数、创建新单前关闭同比赛同用户 pending 旧单。
  - handler/repository 层：DTO 透出（用户端 participants、管理端名册）、错误映射。
  - 提交前：`gofmt -w .`、`go test -race ./...`、`go vet ./...`、`go build -o /tmp/registration-system-go-api ./cmd/api`。
- 小程序：`bun run type-check`、必要时 `build:mp-weixin`；报名提交/费用标签相关既有测试更新并补充必要用例（涉及接口调用与关键状态，按仓库前端测试策略属应测范围）。
- 管理端：`bun run type-check`、`bun run lint`、`bun run build`。
- 发布顺序：Go 后端先行（旧小程序只发 count=1，行为完全不变，向后兼容）→ 管理端与小程序随后各自发版。

## 风险与备注

- 多人合计金额可能触达订单 1 万元上限（人均 100 元 × 100 人）：按现有校验报错，前端展示后端错误信息即可，不做前置拦截。
- 已付锁定对存量数据无影响（存量已付记录 count 均为 1，幂等提交不受限）。
- 改人数后遗留的旧 pending 订单由"下单前关闭旧单"兜底；部署前产生的 pending 单也会在用户下次下单时被清理。
- 容量并发安全沿用现状三级行锁 + `UNIQUE(group_id, user_id)`，本次不引入新约束。
- 成行判定（`min_players`）与组满员判定（`max_players`）均已基于 `SUM(registration_count)`，多人报名天然正确，无需额外处理。
