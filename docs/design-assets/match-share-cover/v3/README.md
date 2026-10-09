# 比赛详情分享封面压缩版

保留“这场球等你来”的原图内容，用 macOS `sips -Z 1000 -s format jpeg -s formatOptions 80` 等比例缩放并编码。原图 1402×1122、1,524,592 字节；压缩图 1000×800、162,096 字节，减少约 89.4%。原 MinIO 对象继续保留。

文件和公开地址见 `asset.json`。新地址采用内容哈希，避免旧图片缓存；对象设置 `image/jpeg` 和一年 immutable 缓存。图片仅供微信比赛分享卡片使用，仍由比赛详情的 `onShareAppMessage` / `onShareTimeline` 同步返回 `imageUrl`；标题和比赛跳转参数不变。线上 `home.share_match_image_url` 与代码默认地址同步更新，其他分享场景配置不变。

压缩图已目视核对人物、文字和构图；公网校验记录见 `public-verification.json`。实际微信转发卡片仍需真机验收，图片体积降低不等于已证明此前缺图的唯一原因。
