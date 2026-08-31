import { DetailGrid, DetailItem } from "@/components/admin/detail-grid";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getApiBaseUrl } from "@/config/api";
import { useAdminSession } from "@/features/admin-session/useAdminSession";

export default function AccessPage() {
  const { currentAdmin: admin } = useAdminSession();

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>管理员身份</CardTitle>
          <CardDescription>当前登录的管理员会话</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label="当前账号">{admin?.username || "--"}</DetailItem>
            <DetailItem label="管理员角色">
              {admin?.is_super_admin ? "超级管理员" : "场馆管理员"}
            </DetailItem>
            <DetailItem label="账号状态">
              {admin?.status === "active" ? (
                <StatusBadge label="已启用" variant="success" />
              ) : (
                <StatusBadge label="已冻结" variant="warning" />
              )}
            </DetailItem>
            <DetailItem label="认证方式">Bearer JWT</DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>服务契约</CardTitle>
          <CardDescription>管理端调用的接口约定</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label="API 基础地址">
              <code>{getApiBaseUrl() || "同源代理"}</code>
            </DetailItem>
            <DetailItem label="健康检查">
              <code>GET /health</code>
            </DetailItem>
            <DetailItem label="管理端前缀">
              <code>/api/v1/admin</code>
            </DetailItem>
            <DetailItem label="登录接口">
              <code>POST /api/v1/admin/auth/login</code>
            </DetailItem>
            <DetailItem label="身份接口">
              <code>GET /api/v1/admin/auth/me</code>
            </DetailItem>
            <DetailItem label="响应契约">
              <code>code / message / data</code>
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
    </div>
  );
}
