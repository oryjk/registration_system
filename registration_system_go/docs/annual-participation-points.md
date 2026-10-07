# 年度参与积分

规则 v1（2026-10-07）：每场已结束、非取消的球队比赛，最终 attending 的队员获得7基础分。本人有效确认参加的时间相对可报名时刻，<=1h、<=6h、<=24h、>24h 分别奖励3、2.4、1.5、0.6分；服务端原报名窗口仍限制报名。可报名时刻取比赛创建、报名组创建、报名开放、入队时间最晚值，所有 timestamp 为UTC。

本人撤销、请假、缺席清除有效确认，重新参加重新计时；同状态参加重复请求不刷新奖励，也不为历史报名补造奖励。管理员修正保存原本人确认时间/奖励；没有可靠本人记录的补录仅7分。非参加状态、取消比赛/组没有积分，不扣负分。同场同队员以同一报名记录为事实，不重复加分。

`match_registrations` 保存 participation_confirmed_at、early_registration_bonus、participation_base_points、participation_rule_version。积分列及SQL汇总统一保存十分之一分的整数（70代表7分），累计、排行保持精确；HTTP响应统一除以10，整数不追加小数尾零，非整数保留一位小数。旧历史记录默认70/0/版本1（即7分基础分），不推断created_at是本人参赛确认。SQL视图 team_participation_points / totals / ranks 统一过滤和汇总；年度归属使用比赛start_time由UTC转北京时间。跨年仅切换查询年份，历史事实保留，无清零任务；管理员修改历史出勤自动影响对应年度。历史汇总不依赖成员当前在队状态，当前荣誉只排名active成员。

接口采用加法扩展：
- 比赛participants：team_participation_points、team_participation_rank，个人组为null。
- 球队members：participation_points、participation_rank，本年度统计。
- attendance-summary：ranking增加participation_points/rank；my_records增加单场积分；annual_points是当前队员本球队的[{year, participation_points}]全部历史年度，不受startDate/endDate过滤。
- 单场/成员出勤明细增加participation_points。旧出勤字段和ranking旧排序保留；新小程序使用新增积分排序与荣誉字段。

## 发布顺序

先应用00039加法迁移，再发布新后端，然后发布小程序。已提交旧sqlc SQL查询均展开显式列，不受新增列影响；旧报名UPDATE不引用新字段，可以继续运行。新后端依赖新增字段/视图，不可先于迁移上线。

迁移Down移除查询视图但保留积分事实列，避免镜像回滚丢历史。Up可重复添加保留列后重建视图。未来更改积分规则需要新版本和明确生效策略，不得修改已保存奖励以静默重算历史。
