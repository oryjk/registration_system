import { ArrowLeft, ShieldX } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <main className="page-result">
      <div className="page-result-icon">
        <ShieldX size={26} />
      </div>
      <div>
        <h3>无权访问</h3>
        <p>当前管理员没有访问此页面的权限。</p>
      </div>
      <Button onClick={() => navigate("/")} type="button" variant="outline">
        <ArrowLeft size={15} />
        返回概览
      </Button>
    </main>
  );
}
