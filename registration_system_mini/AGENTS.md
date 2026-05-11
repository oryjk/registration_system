# registration_system_mini — AGENTS

## 项目定位

微信小程序端，承载普通用户的报名、球队、活动、账单与个人中心相关流程。当前技术栈为 `uni-app + Vue 3 + TypeScript + Vite`。

## 常用命令

```bash
cd registration_system_mini
bun install
bun run dev:mp-weixin
bun run build:mp-weixin
bun run dev:h5
bun run build:h5
bun run type-check
```

## 关键目录

```text
src/
  api/           # 按业务域封装接口
  components/    # 通用组件
  config/        # 环境配置
  pages/         # 小程序页面（activities、teams、billing、user 等）
  static/        # 静态资源
  types/         # 类型定义
  utils/         # 请求、缓存、工具方法
```

## 入口与配置

- 入口文件：`src/main.ts`
- 页面声明：`src/pages.json`
- 环境文件：`.env.development`、`.env.production`

## 协作约定

- 页面逻辑、接口封装、通用工具保持分层，不要把所有请求直接散落在页面里。
- 新增接口优先放入 `src/api/<domain>.ts`，并补充对应类型。
- 修改报名、球队、活动等核心流程时，确认字段与后端真实 JSON 一致。
- 小程序环境差异较多，避免随意引入仅适用于 Web 的 API。
- 前端纯视觉样式调整（颜色、边框、间距、宽度、字号、圆角、阴影等）不需要新增单元测试或静态断言；这类变更以截图/模拟器人工确认效果为准。测试只覆盖路由、接口、数据提交、权限、关键组件接入和业务状态变化等行为。

## 验证建议

- 提交前至少执行 `bun run type-check`
- 若涉及页面流程或路由，补跑 `bun run build:mp-weixin`
- 前端不按 TDD 方式开发；页面、样式、交互、小程序 UI 调整不要求先写测试，优先用类型检查、构建和模拟器/人工验证确认。

## 不要做的事

- 不要提交真实小程序密钥、AppSecret、生产域名配置。
- 不要在单次任务里顺手重写整套页面风格或路由结构。
