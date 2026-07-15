import ApiOutlined from "@ant-design/icons/es/icons/ApiOutlined";
import CheckCircleFilled from "@ant-design/icons/es/icons/CheckCircleFilled";
import ClockCircleOutlined from "@ant-design/icons/es/icons/ClockCircleOutlined";
import CloseCircleFilled from "@ant-design/icons/es/icons/CloseCircleFilled";
import ReloadOutlined from "@ant-design/icons/es/icons/ReloadOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Descriptions from "antd/es/descriptions";
import Grid from "antd/es/grid";
import Space from "antd/es/space";
import Spin from "antd/es/spin";
import Table from "antd/es/table";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import { useCallback, useEffect, useState } from "react";
import { getHealth } from "../api/system";
import { getApiBaseUrl } from "../config/api";

const { Text, Title } = Typography;
const alwaysApply = () => true;

type ServiceState = "checking" | "online" | "offline";

interface HealthSnapshot {
  state: ServiceState;
  latency: number | null;
  checkedAt: Date | null;
  error: string;
}

const initialSnapshot: HealthSnapshot = {
  state: "checking",
  latency: null,
  checkedAt: null,
  error: "",
};

const contractRows = [
  { key: "health", capability: "健康检查", route: "GET /health", layer: "Bootstrap", state: "ready" },
  { key: "wechat", capability: "微信登录", route: "POST /api/auth/wechat/login", layer: "HTTP Handler", state: "ready" },
  { key: "teams", capability: "我的球队", route: "GET /api/teams/my", layer: "HTTP Handler", state: "ready" },
  { key: "admin", capability: "管理员认证", route: "POST /api/admin/auth/login", layer: "HTTP Handler", state: "ready" },
  { key: "matches", capability: "比赛管理", route: "GET /api/admin/matches", layer: "HTTP Handler", state: "ready" },
];

const stateMeta = {
  checking: { label: "检查中", color: "processing", icon: <ClockCircleOutlined /> },
  online: { label: "在线", color: "success", icon: <CheckCircleFilled /> },
  offline: { label: "离线", color: "error", icon: <CloseCircleFilled /> },
} as const;

function formatTime(value: Date | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(value) : "--";
}

export default function DashboardPage() {
  const screens = Grid.useBreakpoint();
  const compactTable = !(screens.md ?? false);
  const [snapshot, setSnapshot] = useState<HealthSnapshot>(initialSnapshot);

  const checkHealth = useCallback(async (shouldApply = alwaysApply) => {
    const startedAt = performance.now();
    if (shouldApply()) setSnapshot((current) => ({ ...current, state: "checking", error: "" }));
    try {
      await getHealth();
      if (!shouldApply()) return;
      setSnapshot({
        state: "online",
        latency: Math.round(performance.now() - startedAt),
        checkedAt: new Date(),
        error: "",
      });
    } catch (error) {
      if (!shouldApply()) return;
      setSnapshot({
        state: "offline",
        latency: null,
        checkedAt: new Date(),
        error: error instanceof Error ? error.message : "无法连接 Go 服务",
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void checkHealth(() => active);
    return () => {
      active = false;
    };
  }, [checkHealth]);

  const meta = stateMeta[snapshot.state];

  return (
    <main className="dashboard-page">
      <section className="page-heading">
        <div>
          <Text className="page-kicker">SYSTEM OVERVIEW</Text>
          <Title level={2}>服务概览</Title>
          <Text type="secondary">当前 Go API 的运行状态与接入边界</Text>
        </div>
        <Tooltip title="重新检查">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<ReloadOutlined spin={snapshot.state === "checking"} />}
            aria-label="重新检查服务"
            onClick={() => void checkHealth()}
          />
        </Tooltip>
      </section>

      <section className="status-strip" aria-label="服务状态摘要">
        <div className="status-cell status-primary">
          <Text>API 状态</Text>
          <Space size={10}>
            {meta.icon}
            <strong>{meta.label}</strong>
          </Space>
        </div>
        <div className="status-cell">
          <Text>响应时间</Text>
          <strong>{snapshot.latency === null ? "--" : `${snapshot.latency} ms`}</strong>
        </div>
        <div className="status-cell">
          <Text>最近检查</Text>
          <strong>{formatTime(snapshot.checkedAt)}</strong>
        </div>
        <div className="status-cell">
          <Text>响应契约</Text>
          <strong>code / message / data</strong>
        </div>
      </section>

      {snapshot.error ? <Alert className="service-alert" type="error" showIcon message="Go 服务不可达" description={snapshot.error} /> : null}

      <div className="dashboard-grid">
        <section className="data-panel">
          <header className="panel-header">
            <div>
              <Text className="panel-kicker">CONNECTION</Text>
              <Title level={4}>连接信息</Title>
            </div>
            {snapshot.state === "checking" ? <Spin size="small" /> : <ApiOutlined className="panel-icon" />}
          </header>
          <Descriptions column={1} size="small" colon={false}>
            <Descriptions.Item label="服务地址"><Text copyable>{getApiBaseUrl()}</Text></Descriptions.Item>
            <Descriptions.Item label="健康路由"><Text code>/health</Text></Descriptions.Item>
            <Descriptions.Item label="管理前缀"><Text code>/api/admin</Text></Descriptions.Item>
            <Descriptions.Item label="鉴权方式">Bearer JWT</Descriptions.Item>
          </Descriptions>
        </section>

        <section className="data-panel panel-note">
          <header className="panel-header">
            <div>
              <Text className="panel-kicker">ADMIN ACCESS</Text>
              <Title level={4}>管理端接入</Title>
            </div>
            <Tag color="success">已装配</Tag>
          </header>
          <Text className="panel-paragraph">管理员认证、球队与比赛管理路由已接入，业务请求使用 Bearer JWT 鉴权。</Text>
        </section>
      </div>

      <section className="table-panel">
        <header className="panel-header">
          <div>
            <Text className="panel-kicker">HTTP SURFACE</Text>
            <Title level={4}>接口接入状态</Title>
          </div>
        </header>
        <Table
          rowKey="key"
          pagination={false}
          scroll={compactTable ? undefined : { x: 680 }}
          dataSource={contractRows}
          columns={[
            { title: "能力", dataIndex: "capability", width: compactTable ? 90 : 150 },
            { title: "路由", dataIndex: "route", render: (value: string) => <Text code className="route-code">{value}</Text> },
            ...(compactTable ? [] : [{ title: "当前层级", dataIndex: "layer", width: 150 }]),
            {
              title: "状态",
              dataIndex: "state",
              width: compactTable ? 92 : 120,
              render: (value: string) => {
                if (value === "ready") return <Tag color="success">已装配</Tag>;
                if (value === "handler") return <Tag color="processing">待路由装配</Tag>;
                return <Tag>待实现</Tag>;
              },
            },
          ]}
        />
      </section>
    </main>
  );
}
