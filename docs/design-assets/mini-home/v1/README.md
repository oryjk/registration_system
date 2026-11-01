# 微信首页视觉素材 v1

按用户于 2026-11-01 确认的首页设计稿，用内置 `image_gen` 生成独立素材。先生成、压缩、上传并校验，再接入微信首页；H5 不使用这些新素材。

- `hero.webp`：1000×500 夜场足球背景，约 50 KB；左侧预留文案。
- `create-team.webp`、`join-team.webp`、`find-game.webp`：256×256 透明插画，每张约 11–13 KB。
- `venue-map.webp`：640×427 透明球场地图插画，约 57 KB。
- 十张默认比赛图：320×320，每张约 17–30 KB。前三张为夜场球场、草地足球、球门球网；其余为俯瞰球场、球鞋与球、角旗、中圈开球、球网近景、训练标志桶、晨光球场。

15 张 WebP 总共 360550 字节（约 352 KB），不进入小程序包；页面只请求需要显示的图片，复用已有 MinIO 本地缓存。原始 PNG 保留在图像工具的生成目录，`catalog.json` 记录原文件名、原尺寸和原字节数；本目录保存实际发布的手机尺寸压缩版，没有再次重绘或裁切素材。

微信创建球队页同时复用 `hero.webp`、`create-team.webp` 与 `join-team.webp`，用于页头和加入入口；没有生成、上传或打包额外图片。

`prompts.json` 记录生成提示词；`catalog.json` 包含尺寸、字节数、SHA256、对象键与公网 URL。首页图片使用 `registration/static/home/visuals/v1/`，比赛图片池使用 `registration/match-covers/default-pool/v1/`，内容哈希命名。复用现有公开只读策略，没有扩大权限、覆盖旧文件或重建 MinIO。`upload-verification.json` 记录 15 张图片的公网 HTTP 200、Content-Type、缓存头与 SHA256 校验结果。

代码清单位于 `registration_system_mini/src/config/homeVisualAssets.ts`。仅微信已结束比赛查看卡使用图片池；自定义封面优先，无封面时按比赛 ID 稳定分配（同场比赛刷新、列表重排和不同报名组不换图）。失败依次降级至分配图、原统一封面、图标，不写回业务数据。待处理行动卡的原有封面规则不变。
