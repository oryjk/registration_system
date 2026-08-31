import {
  CheckCircle2,
  CircleX,
  Clock,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useHealthQuery } from "@/hooks/queries/useSystemQueries";
import { formatClockTime } from "@/utils/format";

export default function DashboardPage() {
  const health = useHealthQuery();
  const state = health.isFetching
    ? "checking"
    : health.isError
      ? "offline"
      : "online";
  const meta = {
    checking: { icon: <Clock size={16} />, label: "检查中" },
    offline: { icon: <CircleX size={16} />, label: "离线" },
    online: { icon: <CheckCircle2 size={16} />, label: "在线" },
  }[state];

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>服务概览</CardTitle>
          <CardDescription>后端 API 当前运行状态</CardDescription>
          <CardAction>
            <Button
              disabled={health.isFetching}
              onClick={() => void health.refetch()}
              type="button"
              variant="outline"
            >
              <RotateCw
                className={health.isFetching ? "spin" : undefined}
                size={15}
              />
              重新检查
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <section aria-label="服务状态摘要" className="status-strip">
            <div className="status-cell status-cell-primary">
              <span>API 状态</span>
              <strong>
                {meta.icon}
                {meta.label}
              </strong>
            </div>
            <div className="status-cell">
              <span>响应时间</span>
              <strong>
                {health.data ? `${health.data.latency} ms` : "--"}
              </strong>
            </div>
            <div className="status-cell">
              <span>最近检查</span>
              <strong>{formatClockTime(health.data?.checkedAt)}</strong>
            </div>
          </section>

          {health.isError ? (
            <div aria-live="polite" className="alert" role="alert">
              <TriangleAlert size={16} />
              <div className="alert-body">
                <strong>后端服务不可达</strong>
                <span>
                  {health.error instanceof Error
                    ? health.error.message
                    : "无法连接后端服务"}
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
