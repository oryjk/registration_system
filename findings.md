# 小程序真实接口接入审计发现

本文件记录审计过程中的关键发现。

## 小程序侧初步扫描

- `src/api/` 已封装 activity、billing、challenge、notification、payment、team、user、wx 等真实请求，均走 `requestApi` 或上传接口。
- 页面层大多通过 `src/api` 调接口：约队大厅、约队详情、首页、比赛创建、比赛详情、通知、资料完善、统计、我的、账单。
- 仍有明确未接入提示：
  - `src/pages/matches/detail.vue` 文案：队长代报名接口待接入。
  - `src/components/BottomTabBar.vue` 存在“待接入”标签。
- `src/mock/appData.ts` 仍存在，但第一轮搜索未发现页面直接 `@/mock` 引用。
- `src/pages/user/index.vue` 中 `getTeamCreditTransactions` 在无 activeTeamId 时使用 `Promise.resolve([])`，这是兜底不是 mock。

## 后端小程序侧路由能力

- `/api/user`：登录、校验、当前用户资料、更新资料、头像上传、活动记录、出勤记录、出勤排行、用户列表等。
- `/api/teams`：球队创建、列表、搜索、加入、我的球队、详情、密码信息、成员管理、队费/信用流水、活动复盘、会员充值、处罚等。
- `/api/activity`：活动列表/详情/创建、本人报名状态、报名用户、签到配置、签到、进行中检查等。管理后台专用批量/代报名接口只在 `/api/admin/activities`。
- `/api/challenges`：约队发布、列表、详情、接约、取消。
- `/api/notifications`：通知列表、未读数、全部标记已读。
- `/api/account` 与 `/api/order`：余额、交易、订单、本人账单流水等。
- `/api/payment`：充值下单、球队会员下单、订单状态、同步、列表、取消、微信回调。
- `/api/wx`：微信登录、access token、手机号。
- `/api/system` 当前只挂载在 `/api/admin/system`，没有挂载到小程序 `/api/system`。

## 页面/功能接入归类

### 已接真实接口的页面主流程

- 会话启动：`uni.login` -> `/api/wx/login` -> `/api/user/login`，已有 token 后走 `/api/user/info`，再拉 `/api/teams/my-teams` 与 `/api/teams/:id`。
- 首页：活动列表、本人活动记录、出勤记录、约队推荐、用户列表、活动报名用户、未读通知数均来自真实接口。
- 约队大厅：约队列表、发布约队、接约来自 `/api/challenges` 真实接口。
- 约队详情：详情、接约、取消来自 `/api/challenges` 真实接口。
- 比赛创建：调用 `/api/activity` 创建活动，包含经纬度和签到配置参数。
- 比赛详情：活动详情、报名用户、球队详情、用户列表、相关活动、本人报名状态更新来自真实接口。
- 账单页：余额和本人账单流水来自 `/api/account/balance`、`/api/order/my-billing-flow`。
- 通知页：通知列表、标记已读、未读数来自 `/api/notifications`。
- 统计页：本人出勤记录、出勤排行来自 `/api/user/attendance`、`/api/user/attendance-ranking`。
- 我的页：活动、本人活动记录、余额、账单、队费流水、通知红点来自真实接口。
- 完善资料：头像上传、资料更新来自 `/api/user/avatar`、`/api/user/info`。

### 部分接入或未接入

- 比赛详情“球队报名/队长代报名”未接入：页面只显示队员自主报名统计，`handleTeamSubmit` 只是 toast；后端对应代报名能力存在于管理端 `/api/admin/activities/:activity_id/registrations`，未作为小程序 `/api/activity` 能力暴露。
- 比赛详情签到未接入 UI：前端 API 已封装 `submitActivityCheckIn`，后端也有 `/api/activity/:activity_id/check-in`，但页面没有使用。
- 签到配置更新未接入 UI：前端 API 已封装 `updateTeamCheckInConfig`，创建比赛时可带配置，但详情页没有修改入口。
- 球队创建/搜索/加入/成员管理没有小程序 UI：后端 `/api/teams` 有接口，但当前小程序只拉我的球队、详情、队费流水等。
- 队费复盘、会员充值、支付下单没有页面入口：前端 API 已有 `submitTeamActivityReview`、`rechargeTeamMembership`、`createTeamMembershipOrder` 等封装，页面未调用。
- 微信手机号接口未接入：后端有 `/api/wx/getPhoneNumber`，小程序当前只使用 `/api/wx/login`。
- 位置解析没有走后端：`src/utils/location.ts` 直接请求腾讯地图公网接口；后端位置搜索/解析当前只挂在管理端活动路由。
- `src/api/system.ts` 的 `/health` 封装未被页面使用。
- `src/components/BottomTabBar.vue` 仍有“待接入”标签，需进一步确认对应导航功能是否预期上线。
- 底部快捷创建里的“创建球队”明确只是占位 toast：`src/components/BottomTabBar.vue` 的 `handleCreateTeam` 提示“创建球队表单尚未接入”。

### Mock/静态数据情况

- `src/mock/appData.ts` 仍存在，但未发现页面直接引用。
- 页面有少量静态文案/默认表单值/空状态，不等同于业务数据 mock。
- `src/utils/payment.ts` 保留 mock 支付参数识别逻辑，主要用于本地支付测试；当前页面未调用支付流程。
