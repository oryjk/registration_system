# registration_system_admin_app

赛事报名系统的移动端管理 App。

## 当前范围

- 创建比赛
- 创建球队
- 管理员账号登录
- 调用现有管理端 API

## 启动

```bash
cd registration_system_admin_app
flutter run
```

## 开发说明

- 首页是管理工作台入口。
- 登录页默认连接本机后端：`http://127.0.0.1:18080/api/admin`。
- Android 模拟器调试前先执行 `adb reverse tcp:18080 tcp:18080`，让 App 内的 `127.0.0.1:18080` 转发到电脑本机后端。
- 创建比赛调用 `POST /api/admin/activities`。
- 创建球队调用 `POST /api/admin/teams/admin`。
- 真机调试时需要把 API 地址改成手机可访问的局域网地址。
