import { SafetyCertificateOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import { Descriptions, Tag, Typography } from "antd";
import { useModel } from "umi";
import { getApiBaseUrl } from "../config/api";

const { Text } = Typography;

export default function AccessPage() {
  const { initialState } = useModel("@@initialState");
  const admin = initialState?.currentAdmin;

  return (
    <PageContainer
      title="接入状态"
      content="管理员身份与服务契约"
      extra={<SafetyCertificateOutlined className="page-container-icon" />}
    >
      <section className="data-panel access-session-panel">
        <Descriptions column={{ xs: 1, sm: 2 }} colon={false}>
          <Descriptions.Item label="当前账号">
            {admin?.username || "--"}
          </Descriptions.Item>
          <Descriptions.Item label="管理员角色">
            {admin?.is_super_admin ? "超级管理员" : "场馆管理员"}
          </Descriptions.Item>
          <Descriptions.Item label="账号状态">
            <Tag color={admin?.status === "active" ? "success" : "warning"}>
              {admin?.status === "active" ? "已启用" : "已冻结"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="认证方式">Bearer JWT</Descriptions.Item>
        </Descriptions>
      </section>

      <section className="data-panel access-contract-panel">
        <Descriptions column={{ xs: 1, sm: 2 }} colon={false}>
          <Descriptions.Item label="API 基础地址">
            <Text copyable>{getApiBaseUrl() || "同源代理"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="健康检查">
            <Text code>GET /health</Text>
          </Descriptions.Item>
          <Descriptions.Item label="管理端前缀">
            <Text code>/api/v1/admin</Text>
          </Descriptions.Item>
          <Descriptions.Item label="登录接口">
            <Text code>POST /api/v1/admin/auth/login</Text>
          </Descriptions.Item>
          <Descriptions.Item label="身份接口">
            <Text code>GET /api/v1/admin/auth/me</Text>
          </Descriptions.Item>
          <Descriptions.Item label="响应契约">
            <Text code>code / message / data</Text>
          </Descriptions.Item>
        </Descriptions>
      </section>
    </PageContainer>
  );
}
