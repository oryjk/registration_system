import PlusOutlined from "@ant-design/icons/es/icons/PlusOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Form from "antd/es/form";
import Grid from "antd/es/grid";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import Result from "antd/es/result";
import Table from "antd/es/table";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import { useEffect, useState } from "react";
import { createAdmin, listAdmins } from "../api/auth";
import { useAuth } from "../auth/useAuth";
import type { AdminUser, CreateAdminPayload } from "../types/auth";

const { Text, Title } = Typography;

interface AdminFormValues extends CreateAdminPayload {
  confirm_password: string;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminListPage() {
  const { admin } = useAuth();
  const screens = Grid.useBreakpoint();
  const compact = !(screens.md ?? false);
  const [form] = Form.useForm<AdminFormValues>();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!admin?.is_super_admin) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    listAdmins()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "管理员列表加载失败",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [admin?.is_super_admin]);

  if (!admin?.is_super_admin) {
    return (
      <Result
        status="403"
        title="无权访问"
        subTitle="仅超级管理员可以管理场馆管理员"
      />
    );
  }

  const openModal = () => {
    form.resetFields();
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setModalError("");
  };

  const submit = async () => {
    let values: AdminFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    setModalError("");
    try {
      const created = await createAdmin({
        username: values.username.trim(),
        password: values.password,
      });
      setItems((current) => [created, ...current]);
      setModalOpen(false);
      form.resetFields();
    } catch (reason) {
      setModalError(
        reason instanceof Error ? reason.message : "场馆管理员创建失败",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-list-page">
      <section className="page-heading">
        <div>
          <Text className="page-kicker">VENUE OPERATORS</Text>
          <Title level={2}>场馆管理员</Title>
          <Text type="secondary">共 {items.length} 个管理账号</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openModal}>
          创建管理员
        </Button>
      </section>

      {error ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message={error}
        />
      ) : null}

      <section className="table-panel admin-table-panel">
        <Table<AdminUser>
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={items}
          columns={[
            {
              title: "账号",
              dataIndex: "username",
              render: (value: string) => <strong>{value}</strong>,
            },
            {
              title: "类型",
              dataIndex: "role",
              width: 140,
              render: (value: AdminUser["role"]) => (
                <Tag color={value === "super_admin" ? "gold" : "green"}>
                  {value === "super_admin" ? "超级管理员" : "场馆管理员"}
                </Tag>
              ),
            },
            {
              title: "状态",
              dataIndex: "status",
              width: 110,
              render: (value: AdminUser["status"]) => (
                <Tag color={value === "active" ? "success" : "warning"}>
                  {value === "active" ? "已启用" : "已冻结"}
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
                    render: formatDateTime,
                  },
                ]),
          ]}
        />
      </section>

      <Modal
        open={modalOpen}
        title="创建场馆管理员"
        okText="创建"
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => void submit()}
        onCancel={closeModal}
        destroyOnHidden
      >
        {modalError ? (
          <Alert
            className="modal-alert"
            type="error"
            showIcon
            message={modalError}
          />
        ) : null}
        <Form<AdminFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          disabled={submitting}
        >
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
        </Form>
      </Modal>
    </main>
  );
}
