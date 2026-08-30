import { Home, MapPinOff } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="page-result">
      <div className="page-result-icon">
        <MapPinOff size={26} />
      </div>
      <div>
        <h3>页面不存在</h3>
        <p>请确认访问地址后重试。</p>
      </div>
      <Button onClick={() => navigate("/")} type="button" variant="outline">
        <Home size={15} />
        返回概览
      </Button>
    </main>
  );
}
