import ArrowLeftOutlined from "@ant-design/icons/es/icons/ArrowLeftOutlined";
import Button from "antd/es/button";
import Result from "antd/es/result";
import { history } from "umi";

export default function ForbiddenPage() {
  return (
    <Result
      status="403"
      title="无权访问"
      subTitle="当前管理员没有访问此页面的权限。"
      extra={
        <Button
          type="primary"
          icon={<ArrowLeftOutlined />}
          onClick={() => history.push("/")}
        >
          返回概览
        </Button>
      }
    />
  );
}
