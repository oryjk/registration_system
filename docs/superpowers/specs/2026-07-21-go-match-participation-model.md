# Go 比赛参与模型

## 目标

用一个 `Match` 聚合承载比赛发布、对手形成和球员报名，避免把“比赛”“约队”“报名”拆成互相复制状态的平行对象。

`publication_mode` 描述的是**对手如何形成**，不是三套比赛类型。球员最终都通过 `match_registration_groups` 和 `match_registrations` 参与同一个 Match。

## 核心对象职责

| 对象 | 只负责什么 | 不负责什么 |
| --- | --- | --- |
| `Match` | 比赛事实、发布方式、对手形成状态、比赛生命周期 | 单个球员的报名状态 |
| `RegistrationGroup` | 一个可报名阵营、容量和开放状态 | 候选球队竞争过程 |
| `TeamApplication` | `online_team` 下候选客队的申请与选择结果 | 球员报名 |
| `Registration` | 某个用户在某个报名组中的出勤表态和人数 | 决定客队是哪支球队 |

## 三种发布方式

| 发布方式 | 业务含义 | 初始报名组 | 对手形成方式 |
| --- | --- | --- | --- |
| `offline_confirmed` | 对手已在线下确定，只把比赛发布到系统 | `host_team` | 创建时填写对手名称；不开放线上招募 |
| `online_team` | 主队在线招募一整支客队 | `host_team` | 候选球队申请，主队管理者选择一支后创建 `guest_team` |
| `online_individual` | 主队在线招募散人组成对手方 | `host_team`、`individual_opponent` | 散人报名人数达到最小值后形成对手 |

## 对手状态

`opponent_state` 是由发布方式和当前参与数据决定的聚合状态：

| 发布方式 | `no_recruitment` | `recruiting` | `confirmed` |
| --- | --- | --- | --- |
| `offline_confirmed` | 永远为此状态 | 不允许 | 不允许 |
| `online_team` | 不允许 | 尚未选择客队 | 已选择客队且存在有效 `guest_team` |
| `online_individual` | 不允许 | 有效报名人数小于最小人数 | 有效报名人数达到最小人数 |

散人达到最大人数时，`individual_opponent` 报名组变为 `closed`；有人取消后人数低于最大值，报名组重新变为 `open`。人数低于最小值时，Match 的对手状态同时回退为 `recruiting`。

## 权限矩阵

| 操作 | 允许的操作者 |
| --- | --- |
| 发布比赛 | 主队队长/领队，或管理员 |
| 主队成员表态 | 主队有效成员本人 |
| 提交整队申请 | 候选球队队长/领队 |
| 选择候选客队 | 主队队长/领队，或管理员 |
| 撤回未选申请 | 申请球队队长/领队 |
| 已选客队退出/主队重开招募 | 已选客队或主队的队长/领队，或管理员 |
| 客队成员表态 | 已选客队有效成员本人 |
| 散人报名/取消 | 登录用户本人 |
| 管理报名状态 | 管理员；后续可按需要开放给球队管理者 |

`captain` 和 `leader` 可以管理比赛；`vice_captain`、`member` 不能代表球队发布、申请或选择对手。

## 状态转换

### `online_team`

```text
recruiting
  -> 候选球队提交 pending 申请（可有多支）
  -> 主队选择一支：该申请 selected，其余 pending 变 rejected
  -> 创建 guest_team 报名组
  -> opponent_state = confirmed
  -> 已选客队退出或主队重开：申请 withdrawn，guest_team cancelled
  -> opponent_state = recruiting
```

选择申请、拒绝其他申请、创建客队报名组和更新 Match 必须在同一个数据库事务中完成。

### `online_individual`

```text
active_count < min:  opponent_state = recruiting, group = open
min <= active_count < max: opponent_state = confirmed, group = open
active_count >= max: opponent_state = confirmed, group = closed
```

报名写入、有效人数统计、报名组开关和 Match 对手状态更新必须在同一个数据库事务中完成。

## 报名状态

- 球队报名组：没有报名记录表示“未表态”；成员可以表态 `attending`、`leave`、`absent`，取消后为 `cancelled`。
- 散人报名组：有效报名使用 `attending`，取消后为 `cancelled`；散人容量按 `registration_count` 求和。
- `unknown` 只用于兼容导入的历史未表态记录，不作为新用户接口的主动提交值。

## 生命周期限制

- 只有 `match.status = registering` 时允许新申请、选择、退出和报名变更。
- `ongoing`、`ended`、`cancelled` 只允许读取历史参与数据。
- `publication_mode`、主队和初始报名组在创建后不可修改。
- 所有写接口都从 JWT Actor 获取用户或管理员身份，不接受客户端传入操作者 ID。

## 实施顺序

1. 用户侧比赛列表和详情，返回报名组、当前用户表态和可执行动作。
2. `online_team` 申请、选择和退出事务。
3. 主队/客队成员表态与散人报名事务。
4. 管理端报名维护与默认人数配置；页面必须提供桌面与手机响应式布局，并通过双视口 E2E。
5. 小程序比赛列表、详情、申请和报名页面。
