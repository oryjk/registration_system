import LockOutlined from "@ant-design/icons/es/icons/LockOutlined";
import UserOutlined from "@ant-design/icons/es/icons/UserOutlined";
import ProFormText from "@ant-design/pro-components/es/form/components/Text";
import { LoginForm } from "@ant-design/pro-components/es/form/layouts/LoginForm";
import Alert from "antd/es/alert";
import Typography from "antd/es/typography";
import { useState } from "react";
import { history, Navigate, useLocation, useModel } from "umi";
import { BrandMark } from "../components/BrandMark";
import { useLoginMutation } from "../hooks/queries/useAuthQueries";
import { sanitizeRedirect } from "../utils/auth-redirect";

const { Text, Title } = Typography;

interface LoginFormValue {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { initialState, setInitialState } = useModel("@@initialState");
  const loginMutation = useLoginMutation();
  const [error, setError] = useState("");
  const location = useLocation();
  const destination = sanitizeRedirect(
    new URLSearchParams(location.search).get("redirect"),
  );

  if (initialState?.currentAdmin) return <Navigate to={destination} replace />;

  const submit = async (values: LoginFormValue) => {
    setError("");
    try {
      const result = await loginMutation.mutateAsync(values);
      await setInitialState((current) => {
        const state = current || initialState;
        if (!state) return current;

        return {
          ...state,
          authBootstrapError: null,
          currentAdmin: result.admin,
        };
      });
      history.push(destination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    }
  };

  return (
    <main className="login-page">
      <section
        className="login-brand-panel"
        style={{
          backgroundImage: `url("${process.env.ADMIN_ROUTE_BASE}login-football.jpg")`,
        }}
      >
        <BrandMark className="brand-symbol login-symbol" />
        <Text className="login-kicker">GO ADMIN CONSOLE</Text>
        <Title>开踢管理台</Title>
        <Text>赛事与球队运营</Text>
      </section>
      <section className="login-form-panel">
        <div className="login-form-inner">
          <Text className="page-kicker">ADMIN ACCESS</Text>
          <Title level={2}>管理员登录</Title>
          {error ? <Alert type="error" showIcon message={error} /> : null}
          <LoginForm<LoginFormValue>
            contentStyle={{ width: "100%", minWidth: 0 }}
            submitter={{
              searchConfig: { submitText: "登录" },
              submitButtonProps: {
                block: true,
                loading: loginMutation.isPending,
                size: "large",
              },
            }}
            onFinish={submit}
          >
            <ProFormText
              name="username"
              label="账号"
              rules={[{ required: true, message: "请输入管理员账号" }]}
              fieldProps={{
                prefix: <UserOutlined />,
                autoComplete: "username",
                placeholder: "管理员账号",
              }}
            />
            <ProFormText.Password
              name="password"
              label="密码"
              rules={[{ required: true, message: "请输入密码" }]}
              fieldProps={{
                prefix: <LockOutlined />,
                autoComplete: "current-password",
                placeholder: "密码",
              }}
            />
          </LoginForm>
        </div>
      </section>
    </main>
  );
}
