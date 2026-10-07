# 年度荣誉海报背景 v1

三款背景均为免费预设，内置 image_gen 生成原始 PNG，1024×1536。原图复制保存在本目录，提示词见 prompts.json。

- pitch.png：绿茵日常，浅底深字。
- gold.png：荣耀金，浅底深字。
- night.png：夜场聚光，深底浅字。

catalog.json 记录 MinIO 公网地址、内容 SHA256、尺寸与素材元数据。upload-verification.json 是上传后的公网 HTTP/内容校验记录。对象位于 registration 桶 static/share/honor-backgrounds/v1/ 下，以内容哈希命名，不覆盖旧素材。

preview.html 是可切换背景和身份的独立设计演示，使用明确标注的示例资料，码区域不可扫描。真实实现位于 mini src/pages/honors：从后端读取本人年度资料，叠加实际微信小程序码后导出海报。背景从 MinIO 获取，原图不进小程序包。

后续收费或自定义上传均未实现：产品仍使用三款免费背景。付费素材必须在服务端验证权益，用户上传图片需通过服务端图片校验和归属管理。
