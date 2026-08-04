import { PlusOutlined } from "@ant-design/icons";
import { ModalForm } from "@ant-design/pro-components/es/form/layouts/ModalForm";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import ProTable, { type ProColumns } from "@ant-design/pro-components/es/table";
import { Alert, Button, Form, Grid, Input, Result, Tag } from "antd";
import { useState } from "react";
import { useModel } from "umi";
import {
  useAdminsQuery,
  useCreateAdminMutation,
} from "../hooks/queries/useAdminQueries";
import type { AdminUser, CreateAdminPayload } from "../types/auth";

interface AdminFormValues extends CreateAdminPayload {
  confirm_password: string;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export default function AdminListPage() {
  const { initialState } = useModel("@@initialState");
  const superAdmin = Boolean(initialState?.currentAdmin?.is_super_admin);
  const screens = Grid.useBreakpoint();
  const compact = !(screens.md ?? false);
  const [form] = Form.useForm<AdminFormValues>();
  const adminsQuery = useAdminsQuery(superAdmin);
  const createAdmin = useCreateAdminMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");

  if (!superAdmin) {
    return (
      <Result
        status="403"
        title="无权访问"
        subTitle="仅超级管理员可以管理场馆管理员"
      />
    );
  }

  const openForm = () => {
    form.resetFields();
    setFormError("");
    setFormOpen(true);
  };

  const submit = async (values: AdminFormValues) => {
    setFormError("");
    try {
      await createAdmin.mutateAsync({
        username: values.username.trim(),
        password: values.password,
      });
      form.resetFields();
      return true;
    } catch (reason) {
      setFormError(errorMessage(reason, "场馆管理员创建失败"));
      return false;
    }
  };

  const columns: ProColumns<AdminUser>[] = [
    {
      title: "账号",
      dataIndex: "username",
      render: (_, item) => <strong>{item.username}</strong>,
    },
    {
      title: "类型",
      dataIndex: "role",
      width: 140,
      render: (_, item) => (
        <Tag color={item.role === "super_admin" ? "gold" : "green"}>
          {item.role === "super_admin" ? "超级管理员" : "场馆管理员"}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (_, item) => (
        <Tag color={item.status === "active" ? "success" : "warning"}>
          {item.status === "active" ? "已启用" : "已冻结"}
        </Tag>
      ),
    },
    ...(compact
      ? []
      : [
          {
            title: "创建时间",
            dataIndex: "created_at",
            width: 190,
            renderText: formatDateTime,
          },
        ]),
  ];

  return (
    <PageContainer
      title="场馆管理员"
      content={`共 ${adminsQuery.data?.length || 0} 个管理账号`}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openForm}>
          创建管理员
        </Button>
      }
    >
      {adminsQuery.error ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          title={errorMessage(adminsQuery.error, "管理员列表加载失败")}
          action={
            <Button size="small" onClick={() => void adminsQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      <ProTable<AdminUser>
        rowKey="id"
        search={false}
        options={false}
        cardProps={{ className: "admin-table-panel" }}
        loading={adminsQuery.isFetching}
        pagination={false}
        dataSource={adminsQuery.data || []}
        columns={columns}
      />

      <ModalForm<AdminFormValues>
        form={form}
        open={formOpen}
        title="创建场馆管理员"
        requiredMark={false}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormError("");
        }}
        submitter={{
          searchConfig: { submitText: "创建", resetText: "取消" },
        }}
        modalProps={{ destroyOnHidden: true }}
        onFinish={submit}
      >
        {formError ? (
          <Alert
            className="modal-alert"
            type="error"
            showIcon
            title={formError}
          />
        ) : null}
        <Form.Item
          name="username"
          label="登录账号"
          rules={[
            { required: true, whitespace: true, message: "请输入登录账号" },
            { max: 64, message: "账号不能超过 64 个字符" },
          ]}
        >
          <Input autoComplete="off" maxLength={64} />
        </Form.Item>
        <Form.Item
          name="password"
          label="初始密码"
          rules={[
            { required: true, message: "请输入初始密码" },
            { min: 6, message: "密码至少需要 6 个字符" },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label="确认密码"
          dependencies={["password"]}
          rules={[
            { required: true, message: "请再次输入密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("两次输入的密码不一致"));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </ModalForm>
    </PageContainer>
  );
}
