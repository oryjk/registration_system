# 首页「其他球队的比赛」tab + 消息页留言联系队长 设计文档

日期：2026-08-25
状态：已实现（后端 00023 迁移 + 四条留言路由 + 列表过滤/队长资料扩展；小程序首页双 tab + 详情联系队长弹窗 + 消息中心「通知/留言」双板块 + 对话详情页）

## 1. 背景与目标

当前首页比赛列表（`GET /matches/home`）只展示「与我相关」的比赛（我的报名 + 我所在球队），
没有加入球队、也没有报名记录的普通用户首页为空，无法发现其他球队的比赛，
更没有渠道与对方球队建立联系。

目标：

1. 首页改为页内双 tab：「我的比赛」（现状）+「其他球队」（其他球队发布的比赛列表）。
2. 任何登录用户可在比赛详情页向主队队长「留言」（弹窗发送）。
3. 留言只对「留言者本人」和「该队队长/领队」可见；查看与回复都在**消息中心**完成
   （不在比赛详情页展示留言历史）。
4. 双向往来：用户留言 → 队长收站内通知 → 队长在消息页回复 → 用户收通知 → 可继续往返。
   不做 IM 级实时，进页面刷新即可。

## 2. 已确认的决策

| 决策点 | 结论 |
| --- | --- |
| 「其他球队」tab 范围 | `scope=others`：与我无关的比赛；有主队（`host_team_id` 非空）、未结束且未取消；不限发布模式 |
| 留言可见性 | 仅留言者本人 + 主队 captain/leader（`team_members.role IN ('captain','leader')`，与小程序 `canManage` 口径一致） |
| 留言载体 | 发起在比赛详情页弹窗；查看/回复在消息中心「留言」板块 + 对话详情页 |
| 开放对象 | 所有登录用户（有球队的也可联系别的队长） |
| 长度限制 | 1~200 字（对齐接约申请 `introduction` 先例），非空 |
| 未读 | 复用现有通知角标，不做对话级已读（YAGNI） |

## 3. Go 后端（registration_system_go）

### 3.1 数据库

迁移 `00023_match_captain_messages.sql`：

```sql
match_captain_messages(
  id UUID PK,                       -- 首条消息 id 即 thread_id
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL,          -- 冗余主队，供队长侧查询
  thread_owner_user_id BIGINT NOT NULL,  -- 串发起人（普通用户）
  sender_user_id BIGINT NOT NULL,   -- 实际发送人（发起人或队长/领队）
  content TEXT NOT NULL CHECK(btrim(content) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

索引：`(match_id, thread_owner_user_id, created_at)`、`(team_id, created_at)`。

### 3.2 查询（db/queries/match.sql，并入 matchsqlc）

- `AppendCaptainMessage`：插入一条留言（service 层生成 id）。
- `ListMyCaptainMessageThreads`：我的对话列表 =
  我发起的串（`thread_owner_user_id = me`）∪ 我任 captain/leader 球队收到的串
  （`team_id IN (SELECT team_id FROM team_members WHERE user_id=me AND role IN ('captain','leader') AND status='active')`）；
  按串聚合：比赛名、主队名、对方（串中另一方）昵称头像、最新一条消息内容/发送人/时间；
  按最新消息时间倒序，分页。
- `ListCaptainMessagesByThread`：单串全部消息（含每条发送人昵称头像、时间），按时间正序。
- `GetCaptainThread`：串首条消息（含 match/team/owner），用于权限判定与回复。
- `ListTeamManagerUserIDs`：球队 captain/leader 的 user_id 集合（通知目标）。

### 3.3 分层

- `domain/captain_message.go`：实体 + `NewCaptainMessage` 校验（content trim 非空、≤200 字）。
- `ports/repository.go`：`CaptainMessageRepository` 接口 +
  `CaptainMessage` / `CaptainMessageThread` 值类型。
- `adapters/postgres/captain_message_repository.go`：实现（挂在现有 `Repository` 上）。
- `application/captain_message_service.go`：
  - `Send(actor, {match_id, content})`：比赛必须存在且有主队；写首条留言（thread_id=新 UUID）；
    通知主队全部 captain/leader（kind=`match_captain_message`，content 含发起人昵称+比赛名+摘要，
    `related_type='captain_message'`，`related_id=thread_id`）。
  - `Reply(actor, {thread_id, content})`：串必须存在；发送者须为串发起人或主队
    captain/leader（复用 `teamapplication.TeamAuthorizer.EnsureManager`）；追加消息；
    通知对方（发起人回复 → 通知管理者们；管理者回复 → 通知发起人）。
  - `ListThreads(actor, page)` / `GetThread(actor, thread_id)`：同可见性规则。
  - `NotificationSink` 接口（对齐 teamfund 先例，发送失败仅记日志不影响主流程）。
- `adapters/http/captain_message_handler.go`：
  - `GET  /api/v1/app/captain-messages`（分页对话列表）
  - `GET  /api/v1/app/captain-messages/:threadId`（对话详情）
  - `POST /api/v1/app/matches/:id/captain-messages`（发起，body `{content}`）
  - `POST /api/v1/app/captain-messages/:threadId/reply`（回复，body `{content}`）
- `bootstrap`：dependencies 构造 + router 注册（用户鉴权组）。

### 3.4 既有接口扩展（只加不改）

- `GET /matches` 新增可选参数：
  - `ends_after`（RFC3339）：`m.end_time > ends_after AND m.status <> 'cancelled'`；
  - `host_team_only=true`：`m.host_team_id IS NOT NULL`。
  不传时行为与现状完全一致（兼容旧客户端）。
- `GET /matches/:id` 响应 `match` 对象新增 `host_captain: {user_id, nickname, avatar_url} | null`
  （`teams.captain_id` JOIN `users`；无主队或无队长时为 null）。

## 4. 小程序（registration_system_mini）

### 4.1 首页双 tab

- `pages/home/index.vue` 加 `NeoSegmentedControl`：「我的比赛」/「其他球队」（先例
  `pages/user/matches/index.vue`）。hero banner 与搜索框在 tab 之上，搜索 scope 跟随 tab
  （mine/others）。
- 新建 `pages/home/components/HomeOtherMatchesSection.vue` + `useHomeOtherMatches.ts`：
  `listMatches({scope:'others', ends_after:now, host_team_only:true})` 分页；
  卡片：比赛名、主队、时间、地点、状态；点击进现有详情页。
- guest 模式：其他球队 tab 显示登录引导，不请求数据。

### 4.2 比赛详情页：只留发送入口

- `host_captain` 存在且我不是该队管理者时显示「联系队长」按钮 → `wd-popup` 留言框
  （textarea，1~200 字）→ 调发起接口 → 成功 toast「已发送，可在消息中心查看回复」。
- 详情页不展示留言历史。

### 4.3 消息中心

- `pages/notifications/index.vue` 顶部 `NeoSegmentedControl`：「通知」（现状）｜「留言」。
- 「留言」列表：对方头像昵称、比赛名、最新消息摘要、时间；点击进新页面
  `pages/messages/thread/index`（pages.json 注册）：气泡对话 + 底部输入框，双方都可回复。
- 通知 kind 映射加 `match_captain_message` → 「球队留言」；点击该通知跳对话详情页。

## 5. 测试

- 后端（TDD，集成测试连测试库独立 schema）：
  - repository：Append/ListThreads（两种身份的可见性并集）/ListByThread；
  - service：Send 校验（比赛不存在/无主队/content 长度）、Reply 权限（发起人 ok、
    管理者 ok、路人 forbidden）、通知写入；
  - handler：四条路由参数与响应结构；`ends_after`/`host_team_only`/`host_captain` 扩展。
- 前端：`useHomeOtherMatches` 分页合并与空态按需补测；其余以 type-check + 构建 + 模拟器人工验证。

## 6. 兼容性

全部为新增路由、新增可选 query 参数、响应新增字段；不删不改既有路由/字段/参数语义，
旧版小程序请求新后端行为不变。
