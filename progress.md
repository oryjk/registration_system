# 小程序真实接口接入审计进度

## 日志

- 开始审计：扫描小程序功能是否接入后端真实接口。
- 完成第一轮小程序静态扫描：发现多数页面调用 `src/api`，但仍有“队长代报名接口待接入”和底部导航“待接入”提示。
- 完成后端 `/api/*` 路由扫描：小程序侧后端能力覆盖较多，但 `/api/system` 未挂载，管理专用活动代报名仍只在 `/api/admin/activities`。
- 完成页面功能对照：主页面数据基本接真实接口，但球队报名、签到 UI、球队创建/加入/成员管理、支付/会员充值、手机号等功能未完整接入。
- 补充扫描“待接入/mock/TODO”关键字：确认创建球队入口为占位 toast，比赛详情队长代报名为占位提示。
- 错误记录：在根目录执行 `git status` 失败，因为根目录不是 Git 仓库；此工作区三个子项目各自为 Git 仓库。
- 实现创建/加入球队页面，接入 `createTeam`、`searchTeams`、`joinTeam`、`getTeamPasswordInfo`。
- 实现队长代报名：小程序调用 `submitTeamRegistration`，后端新增 `/api/activity/:activity_id/team-registration`。
- 实现比赛签到入口：比赛详情页调用 `submitActivityCheckIn` 与当前位置 store。
- 实现会员续费入口：我的页调用 `createTeamMembershipOrder`、`requestWxPayment`、`syncPaymentOrderStatus`。
- 验证：
  - 小程序目标测试 15 passed。
  - 小程序 `bun run type-check` 通过。
  - 后端 `cargo check` 通过。
  - 后端 `cargo test --test activity_checkin_service_business_test` 5 passed。
  - 后端 `cargo test --test remaining_team_activity_routes_test` 4 passed。
- 追加剩余功能计划：手机号绑定、球队成员管理、赛后互评/队费复盘、签到配置修改、钱包订单、地图/系统配置。
- 新增剩余功能集成测试并确认 RED：5 个功能组测试失败，证明当前缺口可被测试捕获。
- 实现剩余功能：手机号绑定、队员管理、赛后互评、签到配置修改、钱包充值/订单、后端地图位置路由与小程序位置反查。
- 验证：小程序目标测试 30 passed；小程序 type-check 通过；后端 cargo check 通过；activity_checkin_service_business_test 5 passed；remaining_team_activity_routes_test 4 passed。
