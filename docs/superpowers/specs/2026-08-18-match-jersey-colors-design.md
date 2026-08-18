# 比赛球服颜色设计（主队白 / 客队红默认）

- 日期：2026-08-18
- 状态：已与需求方确认（方案 A；不做存量颜色迁移）
- 涉及：`registration_system_go`、`registration_system_backend_fe_go`、`registration_system_mini`

## 背景与问题

- 小程序创建比赛表单（`MatchPublishForm.vue`）早已收集主队/对手球服颜色，但 `CreateMatchPayload` 没有颜色字段，提交时被丢弃。
- Go 的 Match 领域、DTO、`matches` 表均无颜色列。
- 详情页颜色是 `detailData.ts` 硬编码（`#9be22b`/`#0f766e`）；legacy 活动路径另有页面兜底色（`#2f6bff`/`#d9ff16`）。

## 目标

1. 管理端编辑比赛时可设置主队/客队球服颜色（取色器 + 预设色板，Ant Design ColorPicker）。
2. 小程序创建比赛时把表单已收集的颜色真正提交并存储。
3. 小程序比赛详情展示真实颜色；未设置时默认主队 **#FFFFFF（白）**、客队 **#FF0000（红）**。

## 非目标（明确不做）

- **存量数据迁移**：`migratelegacydb` / `importlegacymatches` 不映射旧库颜色；存量比赛保持 NULL，展示走默认色。`legacymatches` 模型丢弃颜色的现状注释保持不变。
- `/challenges` 约队链路（Go 端未实现该路由）；后续实现时直接复用颜色列。
- 球队档案级颜色（按球队配置、比赛继承）——未来增强。

## 数据模型（Go）

- 迁移 `db/migrations/00014_match_jersey_colors.sql`：
  `ALTER TABLE matches ADD COLUMN host_color TEXT NULL, ADD COLUMN away_color TEXT NULL;`
  可空，不回填。NULL = 未设置，读侧兜底默认色。
- 命名对齐既有 `host_team_id`/`away_team_id`；JSON 字段 `host_color`/`away_color`。
- domain（`internal/match/domain/match.go`）：
  - `Match.HostColor` / `Match.AwayColor string`（空串 = 未设置）。
  - `NewMatchInput.HostColor` / `AwayColor *string`（创建时可选传入）。
  - `UpdateMatchDetails.HostColor` / `AwayColor *string`，三态语义与 `OpponentName` 一致：nil = 不修改；空串 = 清除为 NULL；非空 = 设置。
- 校验与归一化放 domain：必须匹配 `^#[0-9a-fA-F]{6}$`，统一转小写入库；非法值返回 `KindValidation` 错误。

## API 契约

- 用户端 `POST /api/v1/app/matches`：请求新增可选 `host_color`/`away_color`。
- 用户端比赛详情（`GET /matches/:id`）与列表响应、管理端比赛响应：返回 `host_color`/`away_color`（未设置为 `null`）。
- 管理端 `PATCH /api/v1/admin/matches/:id`：请求新增可选字段（指针接收，支持不改/清除/设置三态）。
- `docs/openapi.yaml` 同步更新并通过 `openapi_test`。

## 管理端（registration_system_backend_fe_go）

- `src/pages/MatchFormPage.tsx`：新增「主队球服颜色」「客队球服颜色」两个 `Form.Item` + antd `ColorPicker`（带常用球服色 presets）；未设置时默认显示 #FFFFFF / #FF0000。
- `src/utils/match-form-payload.ts`：创建与更新两条组装路径带上颜色，取 `toHexString()`（hex6）。
- `src/types/match.ts` 同步类型。

## 小程序（registration_system_mini）

- `src/api/match.ts`：`CreateMatchPayload` 新增 `host_color?`/`away_color?`。
- `src/pages/matches/create/createMatchPayload.ts`：把表单的 `color`/`opposingColor` 映射进 payload（当前被丢弃）。
- `src/pages/matches/detailData.ts`：`toBackendActivity` 映射 `host_color → color`、`away_color → opposing_color`，删除硬编码 `#9be22b`/`#0f766e`；未设置为 null。
- `src/pages/matches/useMatchDetailPage.ts`：页面兜底色改为 `#FFFFFF` / `#FF0000`（`hero-flag`、kit-dot 均有描边，白色可见）。
- 创建表单 UI 不改（色板已存在）。

## 测试与验证

- Go（TDD）：domain 颜色校验/归一化/三态更新单测 → handler DTO 映射测试 → postgres repository 集成测试（`testsupport` 独立 schema）→ openapi 测试。
- 管理端：`match-form-payload.test.ts` 补颜色组装断言；`bun run type-check`、`build`。
- 小程序：`createMatchPayload` 与 `detailData` 单测补颜色映射断言；`type-check`、`build:mp-weixin`。
- 发布顺序：Go + 管理端 + H5 全量部署 out109（含 DB 迁移）→ 管理端验证设置颜色 → 小程序验证创建/展示 → 小程序随下次发版生效。

## 风险与备注

- 已结束/已取消比赛的编辑限制沿用既有规则（`UpdateDetails` 冲突检查），颜色随之受限，符合预期。
- 管理端 ColorPicker 需保证提交值为 hex6（`toHexString()`），避免 rgba 字符串入库。
- legacy 活动路径（数字 id）继续使用活动自身 `color/opposing_color` 字段，本设计不触碰。
