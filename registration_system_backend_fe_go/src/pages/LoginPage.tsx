import LockOutlined from "@ant-design/icons/es/icons/LockOutlined";
import UserOutlined from "@ant-design/icons/es/icons/UserOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Form from "antd/es/form";
import Input from "antd/es/input";
import Typography from "antd/es/typography";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const { Text, Title } = Typography;

interface LoginFormValue {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { admin, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from || "/";

  if (admin) return <Navigate to={destination} replace />;

  const submit = async (values: LoginFormValue) => {
    setSubmitting(true);
    setError("");
    try {
      await login(values.username, values.password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-symbol login-symbol">KT</div>
        <Text className="login-kicker">GO ADMIN CONSOLE</Text>
        <Title>开踢管理台</Title>
        <Text>赛事与球队运营</Text>
      </section>
      <section className="login-form-panel">
        <div className="login-form-inner">
          <Text className="page-kicker">ADMIN ACCESS</Text>
          <Title level={2}>管理员登录</Title>
          {error ? <Alert type="error" showIcon message={error} /> : null}
          <Form<LoginFormValue> layout="vertical" size="large" onFinish={submit} requiredMark={false}>
            <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入管理员账号" }]}>
              <Input prefix={<UserOutlined />} autoComplete="username" placeholder="管理员账号" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>登录</Button>
          </Form>
        </div>
      </section>
    </main>
  );
}
