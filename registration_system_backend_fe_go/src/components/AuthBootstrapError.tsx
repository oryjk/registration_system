import ReloadOutlined from "@ant-design/icons/es/icons/ReloadOutlined";
import Button from "antd/es/button";
import Result from "antd/es/result";

interface AuthBootstrapErrorProps {
  message: string;
  onRetry: () => void;
}

export function AuthBootstrapError({
  message,
  onRetry,
}: AuthBootstrapErrorProps) {
  return (
    <Result
      status="error"
      title="管理员信息加载失败"
      subTitle={message}
      extra={
        <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
          重新加载
        </Button>
      }
    />
  );
}
