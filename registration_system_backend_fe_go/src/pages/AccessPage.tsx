import SafetyCertificateOutlined from "@ant-design/icons/es/icons/SafetyCertificateOutlined";
import Descriptions from "antd/es/descriptions";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import { useAuth } from "../auth/useAuth";

const { Text, Title } = Typography;

export default function AccessPage() {
  const { admin } = useAuth();

  return (
    <main className="access-page">
      <section className="page-heading">
        <div>
          <Text className="page-kicker">ACCESS CONTROL</Text>
          <Title level={2}>接入状态</Title>
          <Text type="secondary">管理员身份与权限入口</Text>
        </div>
      </section>
      <section className="data-panel">
        <header className="panel-header">
          <div>
            <Text className="panel-kicker">AUTHENTICATED SESSION</Text>
            <Title level={4}>当前管理员</Title>
          </div>
          <SafetyCertificateOutlined className="panel-icon" />
        </header>
        <Descriptions column={{ xs: 1, sm: 2 }} colon={false}>
          <Descriptions.Item label="账号">{admin?.username || "--"}</Descriptions.Item>
          <Descriptions.Item label="角色">{admin?.is_super_admin ? "超级管理员" : "场馆管理员"}</Descriptions.Item>
          <Descriptions.Item label="账号状态">
            <Tag color={admin?.status === "active" ? "success" : "warning"}>{admin?.status === "active" ? "已启用" : "已冻结"}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="认证状态"><Tag color="success">已认证</Tag></Descriptions.Item>
          <Descriptions.Item label="登录路由"><Text code>POST /api/admin/auth/login</Text></Descriptions.Item>
          <Descriptions.Item label="身份路由"><Text code>GET /api/admin/auth/me</Text></Descriptions.Item>
          <Descriptions.Item label="鉴权方式">Bearer JWT</Descriptions.Item>
        </Descriptions>
      </section>
    </main>
  );
}
