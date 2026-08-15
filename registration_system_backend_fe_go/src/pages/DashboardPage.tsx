import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  ReloadOutlined,
} from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import { Alert, Button, Space, Typography } from "antd";
import { useHealthQuery } from "../hooks/queries/useSystemQueries";

const { Text } = Typography;

function formatTime(value: Date | undefined) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(value)
    : "--";
}

export default function DashboardPage() {
  const health = useHealthQuery();
  const state = health.isFetching
    ? "checking"
    : health.isError
      ? "offline"
      : "online";
  const meta = {
    checking: {
      color: "processing",
      icon: <ClockCircleOutlined />,
      label: "检查中",
    },
    offline: {
      color: "error",
      icon: <CloseCircleFilled />,
      label: "离线",
    },
    online: {
      color: "success",
      icon: <CheckCircleFilled />,
      label: "在线",
    },
  }[state];

  return (
    <PageContainer
      title="服务概览"
      content="后端 API 当前运行状态"
      extra={
        <Button
          type="primary"
          icon={<ReloadOutlined spin={health.isFetching} />}
          loading={health.isFetching}
          onClick={() => void health.refetch()}
        >
          重新检查
        </Button>
      }
    >
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
          <strong>{health.data ? `${health.data.latency} ms` : "--"}</strong>
        </div>
        <div className="status-cell">
          <Text>最近检查</Text>
          <strong>{formatTime(health.data?.checkedAt)}</strong>
        </div>
      </section>

      {health.isError ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message="后端服务不可达"
          description={
            health.error instanceof Error
              ? health.error.message
              : "无法连接后端服务"
          }
        />
      ) : null}
    </PageContainer>
  );
}
