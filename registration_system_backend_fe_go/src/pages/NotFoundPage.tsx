import { HomeOutlined } from "@ant-design/icons";
import { Button, Result } from "antd";
import { history } from "umi";

export default function NotFoundPage() {
  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="请确认访问地址后重试。"
      extra={
        <Button
          type="primary"
          icon={<HomeOutlined />}
          onClick={() => history.push("/")}
        >
          返回概览
        </Button>
      }
    />
  );
}
