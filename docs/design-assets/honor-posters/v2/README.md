# 年度荣誉背景 v2：压缩图片与缩略图

源图和生成提示词保留在 `../v1/`。本次按用户确认的方案做确定性的 JPEG 编码和缩略图缩放，使用 macOS `sips`，没有重新生成或改动背景设计。原 PNG 与原 MinIO 对象保留，旧客户端继续可用。

| 背景 | 高清 JPEG，1024×1536 | 缩略 JPEG，256×384 |
| --- | ---: | ---: |
| 绿茵日常 | 224805 字节 | 15713 字节 |
| 荣耀金 | 277670 字节 | 13774 字节 |
| 夜场聚光 | 252430 字节 | 15164 字节 |

高清图使用 JPEG 质量 80，缩略图使用质量 70。海报预览和导出只读取所选高清图；背景选择区只读取三张缩略图。首次打开本人页面需要约 0.27～0.32 MB 背景素材，原方案三张 PNG 合计 6.23 MB；头像与小程序码不包含在这些数字中。导出仍为 1024×1536，星数、昵称和真实小程序码在背景上独立绘制。

`catalog.json` 记录本地文件、对象地址、尺寸、编码质量、字节数与 SHA256。六个对象位于 `registration/static/share/honor-backgrounds/v2/` 的内容哈希路径，HTTP 类型为 `image/jpeg`，使用一年 immutable 缓存。`upload-verification.json` 记录公网 GET、内容类型、字节数、SHA256、缓存与 CORS 验证。

小程序通过 `uni.downloadFile` 和 `uni.getFileSystemManager()` 缓存六个公共预设文件，打开时检查缓存路径是否仍有效，并合并并发下载。缓存空间不足则使用临时文件，下载失败则允许远程加载和后续重试。头像、小程序码和任意外部 URL 不进入此持久缓存。H5 使用 HTTP 缓存，文件系统逻辑经条件编译隔离。文件 API 依据 [uni-app 文件系统文档](https://uniapp.dcloud.net.cn/api/file/getFileSystemManager)；未采用已停止维护的旧文件接口。

从仓库根目录重现编码（macOS）：

```sh
for id in pitch gold night; do
  sips -s format jpeg -s formatOptions 80 "docs/design-assets/honor-posters/v1/$id.png" --out "docs/design-assets/honor-posters/v2/$id.jpg"
  sips -s format jpeg -s formatOptions 70 -Z 384 "docs/design-assets/honor-posters/v1/$id.png" --out "docs/design-assets/honor-posters/v2/$id-thumb.jpg"
done
```

重新编码后需核对 SHA256，更新目录元数据与客户端 URL；不得把新内容覆盖到旧哈希对象地址。
