# 新手引导插画 v1

2026-09-26 使用内置 `image_gen` 生成。完整提示词见 [prompts.json](./prompts.json)。三张均为 1254×1254、RGBA 真透明 PNG，无文案。原图保存在此目录，不进入 `src/static`，不增加小程序包体。

| 文件 | 后台配置位 | 使用场景 | 大小 |
| --- | --- | --- | --- |
| welcome-v1.png | 首次进入（welcome） | 首页首次任务选择、使用帮助顶部 | 1,210,037 bytes |
| team-v1.png | 组队 / 入队（team） | 建队/入队引导、邀请队友优先状态、建队/入队成功 | 1,052,313 bytes |
| match-v1.png | 找比赛（match） | 个人找球、队员尚无比赛状态 | 878,570 bytes |

## 初次启用与之后更换

部署本轮 Go 后端和管理端、上传新版小程序后，在管理后台「系统设置」按上表选择图片并上传。上传成功即将新 URL 保存到对应场景配置；以后换图无需重新发布小程序。小程序下一轮刷新/重新进入并拉取配置后生效；停留中的页面不会实时推送更新。

可单独清空任何一个场景，首页回退内置球场装饰，帮助/成功页不显示插画，不影响其他配置位。已有首页/约队宣传图的 `next_match_social_image_url` 保持独立。

上传沿用对象存储、内容哈希 URL 与 2MB 文件上限；支持 PNG/JPG/WebP，推荐透明 PNG、无文字、正方形、四周留出安全边距。后续替换建议保持三图风格与人物比例一致。

## 技术契约

- `home.onboarding_welcome_image_url`
- `home.onboarding_team_image_url`
- `home.onboarding_match_image_url`
- 上传：`POST /api/v1/admin/system/mini-app-settings/home/onboarding-images/{welcome|team|match}`，multipart 字段 `file`。
- 设置 / 清空：已有 `PUT /api/v1/admin/system/mini-app-settings`，仅传对应 `home` 字段，空串为清空。
- 小程序：通过已有公开运行配置接口获取；老服务器缺字段视为空，旧版小程序忽略新增字段。

素材已上传到对象存储。初始化时仅原子合并这三个场景的配置，不修改现有宣传图。

## 本轮验证

- 小程序类型检查、553项测试、H5及微信构建、组件/分包检查通过。
- 管理端类型检查、lint、57项单元测试、生产构建与桌面/手机2项业务E2E通过。
- Go全量race、vet、build，system真实PostgreSQL集成和并发更新回归通过。初轮全量集成中的单个数据库连接超时用例重试通过，OpenAPI变更已同步并复验。
- H5手机视口使用本地素材和模拟运行配置验证：首页与帮助、收起/展开、图片失败回退及同URL刷新后重试，页面无JS异常。截图见 [首页](./preview/home.png)、[帮助](./preview/help.png)。这些截图不是线上环境。
- 尚未做微信真机验收。
