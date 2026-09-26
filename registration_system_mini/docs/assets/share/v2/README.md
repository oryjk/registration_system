# 分享封面 v2 · 2026-09-26

使用内置 image_gen 生成，与新版新手引导的海军蓝 / 薄荷绿 2.5D 成人球友插画保持一致。完整提示词在 [prompts.json](./prompts.json)。

| 文件 | 分享入口 | 文案 | 现有代码常量 |
| --- | --- | --- | --- |
| [home.png](./home.png) | 首页 | 约球开踢 / 组队 · 报名 · 上场 | HOME_SHARE_IMAGE_URL |
| [hall.png](./hall.png) | 约队大厅 | 找一场球踢 / 约对手 · 找球友 · 一起上场 | DEFAULT_SHARE_IMAGE_URL |
| [team-invite.png](./team-invite.png) | 球队邀请 | 加入球队 / 和队友一起上场 | TEAM_INVITE_SHARE_IMAGE_URL |
| [match-detail.png](./match-detail.png) | 比赛详情 | 这场球，等你来 / 查看比赛 · 报名上场 | MATCH_DETAIL_SHARE_IMAGE_URL |

四张为 1402×1122 PNG，约 5:4 横向卡片。已检查生成内容、汉字与图像尺寸。移除旧封面中的示例比赛时间、年龄/人数限制、赛事信息和截图窗口边框；封面不写死球队或比赛事实。

球队邀请图左下保留动态队徽空间，对齐 `src/utils/shareCompose.ts` 的 1000×800 画布、圆心(320,640)、半径95。接入时沿用现有合成逻辑，需真机检查最终分享卡片。

新版图片已上传到对象存储的版本化路径（旧文件保留）。小程序的默认封面已更新，并支持通过后台「系统设置 → 分享封面」独立上传更换/清空；清空时回退这套新版默认封面。新配置在页面再次显示时预取，分享回调同步使用；球队邀请封面或队徽变化后重新合成，过期异步结果不会覆盖新图。

后台显示推荐 5:4、1000×800px、PNG/JPG/WebP、不超过2MB，以及选择文件的实际尺寸。比例偏差只提示，不拒绝近似5:4图片。当前原图1402×1122，与5:4的偏差小于1%。

配置字段为 `home.share_home_image_url` / `share_hall_image_url` / `share_team_image_url` / `share_match_image_url`。上传使用 `POST /api/v1/admin/system/mini-app-settings/home/share-images/{home|hall|team|match}`，multipart 字段 `file`。设置/清空仍通过原 settings PUT 接口，仅原子合并本次字段。

| 场景 | 对象路径（registration桶） |
| --- | --- |
| home | static/share/v2/home/efca682b6c5c37be.png |
| hall | static/share/v2/hall/ce7d5989e065c151.png |
| team | static/share/v2/team/ff97d8a79c4c24fb.png |
| match | static/share/v2/match/18677ed042e00b13.png |
