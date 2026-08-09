# Go 微信支付充值与钱包设计

## 目标

在 `registration_system_go` 中实现首版资金能力：微信小程序通过微信支付 V2 JSAPI 创建充值订单，支付成功后将金额原子充值到当前用户钱包。后续比赛报名等场景只从钱包扣费，不直接耦合微信支付。

首轮只修改 Go 后端与文档，不修改小程序、管理端或 Rust 后端；本地通过 `go run ./cmd/api` 运行，不使用 Docker。

## 范围

首版包含：

- 微信支付 V2 `unifiedorder`、`orderquery`、`closeorder` 与支付结果通知。
- 微信小程序 JSAPI 支付参数生成。
- 自由输入充值金额，最小 1 分，不设业务上限；实际值仍必须能由 `int64` 表示并受微信商户平台限制。
- 充值订单创建、本人列表、本人详情、主动同步和未支付订单取消。
- 钱包余额、不可变资金流水、原子充值和余额不足时拒绝扣费。
- 管理端只读查询支付订单和用户钱包。
- 开发/测试 Mock 支付闭环。
- OpenAPI、配置示例、运行与联调文档。

首版不包含退款、提现、人工调账、管理端写操作、微信内 H5 支付、前端页面，以及 Rust 余额/订单/流水迁移。Go 钱包从零开始，Rust 数据保持只读且不修改。

## 模块边界

### payment

- `domain`：充值订单、状态和值对象。
- `application`：创建、查询、同步、取消、回调结算的业务编排。
- `ports`：订单仓储、用户 OpenID 查询、微信 V2 gateway、原子充值结算。
- `adapters/wechatv2`：V2 XML、MD5 签名、统一下单、查单、关单、回调解析。
- `adapters/postgres`：订单持久化和支付成功事务。
- `adapters/http`：App、Admin 与 webhook 协议适配。

### wallet

- `domain`：钱包账户、资金流水、余额不足等规则。
- `application`：查询余额/流水和内部扣费用例。
- `ports`：钱包查询与原子扣费。
- `adapters/postgres`：钱包查询和事务写入。
- `adapters/http`：App 与 Admin 只读接口。

支付成功的充值事务由 payment 持久化适配器协调支付订单与 wallet 表；业务模块不共享数据库连接对象或 SQL 文本。

## HTTP 契约

App 用户接口均要求用户 JWT：

- `POST /api/v1/app/payments/recharge-orders`
- `GET /api/v1/app/payments/orders`
- `GET /api/v1/app/payments/orders/{order_no}`
- `POST /api/v1/app/payments/orders/{order_no}/sync`
- `POST /api/v1/app/payments/orders/{order_no}/cancel`
- `GET /api/v1/app/wallet`
- `GET /api/v1/app/wallet/transactions`

Admin 接口均要求管理员 JWT，且只读：

- `GET /api/v1/admin/payments/orders`
- `GET /api/v1/admin/payments/orders/{order_no}`
- `GET /api/v1/admin/wallets/{user_id}`

微信回调独立于 app/admin：

- `POST /api/v1/webhooks/wechat-pay`

普通接口继续使用 `{code,message,data}`；微信回调严格返回微信 V2 XML。金额字段统一为整数分，例如 `{"amount_cents":3000}`。创建订单不接受客户端 `openid`，服务端依据 JWT 用户读取 `users.openid`。

## 数据模型

`payment_orders`：

- `order_no`：应用生成的稳定订单号，主键。
- `user_id`、`amount_cents`。
- `provider=wechat`、`channel=mini_program_jsapi`。
- `status=pending|paid|cancelled|failed`。
- `prepay_id`、`transaction_id`。
- `paid_at`、`cancelled_at`、`created_at`、`updated_at`。

`wallet_accounts`：

- `user_id` 主键。
- `balance_cents`、`total_recharged_cents`、`total_spent_cents`。
- `version`、`created_at`、`updated_at`。

`wallet_transactions`：

- `id`、`user_id`、`direction=credit|debit`、`type=recharge|spend`。
- `amount_cents`、`balance_after_cents`。
- `source_type`、`source_id`、`description`、`created_at`。
- `(source_type, source_id)` 唯一，作为充值与未来扣费的幂等键。

数据库约束拒绝非正金额、负余额、非法枚举值和重复微信交易号。列表接口使用 `page`/`page_size`，默认 1/20，`page_size` 最大 100。

## 支付与结算流程

创建充值订单：

1. 从 JWT Actor 取得用户 ID，验证 `amount_cents >= 1`。
2. 从 Go `users` 表读取当前用户 OpenID。
3. 创建本地 `pending` 订单。
4. 调用微信 V2 `unifiedorder`；成功后保存 `prepay_id` 并返回小程序 `requestPayment` 参数。
5. 上游明确拒绝时订单记为 `failed`；网络或系统错误返回 502，保留订单用于对账，不伪装为 Mock 成功。

支付成功由主动同步或 webhook 进入同一结算用例。单 PostgreSQL 事务执行：

1. 锁定支付订单。
2. 校验订单用户、金额、`appid`、`mch_id` 和微信交易号。
3. 首次成功时将订单置为 `paid`。
4. 创建或锁定钱包账户。
5. 插入唯一充值流水。
6. 仅在流水首次插入时增加余额与累计充值额。
7. 提交后才向微信返回成功 XML。

重复通知、重复同步和通知/同步并发都不得重复充值。

取消订单：仅本人 pending 订单可取消。服务端先调用微信 V2 `closeorder`，仅在 `SUCCESS` 或 `ORDERCLOSED` 后将本地订单置为 `cancelled`；`ORDERPAID` 改走查单与结算；`SYSTEMERROR` 保持 pending 并返回上游错误，允许重试。

钱包扣费作为内部应用能力提供：在事务中锁账户，余额不足返回领域错误，不允许负数；首版没有对外扣费 HTTP 接口。

## 微信 V2 安全

- 请求与响应都使用结构化 XML 编解码，不使用正则或字符串拼接解析 XML。
- 签名算法为 V2 MD5，参数按键名排序，追加 `key` 后大写十六进制。
- 所有微信响应和 webhook 必须验签，比较使用恒定时间。
- webhook 额外校验 `appid`、`mch_id`、订单号、金额和结果状态。
- 不记录 API Key、OpenID、签名、完整 XML、JWT 或数据库连接串。
- 微信上游网络、协议和系统错误映射为 HTTP 502。

## 配置

- `WECHAT_PAY_USE_MOCK`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_API_KEY`
- `WECHAT_PAY_API_BASE_URL`，默认 `https://api.mch.weixin.qq.com`
- `PUBLIC_BASE_URL`
- `WECHAT_PAY_NOTIFY_PATH`，默认 `/api/v1/webhooks/wechat-pay`

Mock 只允许 development/test。production 必须禁用 Mock，且缺少商户号、API Key 或合法公网回调基址时启动失败，不允许静默回退。

Mock 创建订单后保持 `pending`，调用同步接口后模拟支付成功并充值，用于本地完整闭环。真实微信联调需要商户配置、有效小程序 OpenID 与公网 HTTPS 回调。

## 测试与交付

- domain/application：金额边界、状态转换、所有权、重复结算、余额不足。
- wechatv2：MD5 固定向量、XML 编解码、响应验签、统一下单/查单/关单结果映射。
- HTTP/bootstrap：JWT 隔离、app/admin/webhook 路径、错误码和 XML 回调。
- PostgreSQL：使用明确提供的专用 `TEST_DATABASE_URL` 验证 migration、原子充值、重复通知和余额扣费；未配置时跳过，不连接未知开发/生产库，也不启动 Docker。
- OpenAPI 漂移测试保证新增 Gin 路由全部出现在契约中。
- 完成后执行 `gofmt -w .`、非数据库测试、`go test -race ./...`（环境允许时）、`go vet ./...`、API build 和 `git diff --check`。
