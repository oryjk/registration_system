import { RotateCcw, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

interface AuthBootstrapErrorProps {
  message: string;
  onRetry: () => void;
  loginUrl?: string;
}

export function AuthBootstrapError({
  message,
  onRetry,
  loginUrl,
}: AuthBootstrapErrorProps) {
  return (
    <div className="bootstrap-error">
      <div className="bootstrap-error-icon">
        <TriangleAlert size={22} />
      </div>
      <div className="bootstrap-error-body">
        <h3>管理员信息加载失败</h3>
        <p>{message}</p>
        {loginUrl && (
          <Button
            asChild
            className="justify-self-start"
            size="sm"
            variant="link"
          >
            <Link to={loginUrl}>切换服务器</Link>
          </Button>
        )}
      </div>
      <Button onClick={() => onRetry()} type="button" variant="outline">
        <RotateCcw size={15} />
        重新加载
      </Button>
    </div>
  );
}
