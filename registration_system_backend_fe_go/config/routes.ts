export default [
  { path: "/login", layout: false, component: "./LoginPage" },
  {
    path: "/",
    name: "系统概览",
    icon: "DashboardOutlined",
    component: "./DashboardPage",
  },
  {
    path: "/matches",
    name: "比赛管理",
    icon: "CalendarOutlined",
    component: "./MatchListPage",
  },
  {
    path: "/matches/new",
    name: "发布比赛",
    hideInMenu: true,
    component: "./MatchFormPage",
  },
  {
    path: "/matches/:id",
    name: "比赛详情",
    hideInMenu: true,
    component: "./MatchDetailPage",
  },
  {
    path: "/matches/:id/edit",
    name: "编辑比赛",
    hideInMenu: true,
    component: "./MatchFormPage",
  },
  {
    path: "/teams",
    name: "球队管理",
    icon: "TeamOutlined",
    component: "./TeamListPage",
  },
  {
    path: "/admins",
    name: "场馆管理员",
    icon: "ShopOutlined",
    component: "./AdminListPage",
  },
  {
    path: "/access",
    name: "接入状态",
    icon: "SafetyCertificateOutlined",
    component: "./AccessPage",
  },
];
