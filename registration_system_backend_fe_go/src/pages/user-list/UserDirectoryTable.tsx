import { ActivityCell } from "@/components/admin/activity-cell";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { DateTimeCell } from "@/components/admin/date-time-cell";
import { SortHeader } from "@/components/admin/sort-header";
import { StatusBadge } from "@/components/admin/status-badge";
import type { WeChatUser } from "@/types/user";
import { UserIdentityCell } from "./UserIdentityCell";

interface UserDirectoryTableProps {
  users: WeChatUser[];
  loading: boolean;
  filtered: boolean;
  onSort: (column: "last_active" | "created") => void;
  sortDirection: (column: "last_active" | "created") => "asc" | "desc" | null;
}

export function UserDirectoryTable({
  users,
  loading,
  filtered,
  onSort,
  sortDirection,
}: UserDirectoryTableProps) {
  const columns: DataTableColumn<WeChatUser>[] = [
    {
      key: "nickname",
      title: "用户",
      width: "27%",
      render: (user) => <UserIdentityCell user={user} />,
    },
    {
      key: "phone_number",
      title: "手机号",
      width: "16%",
      render: (user) => (
        <span className={user.phone_number ? "cell-tabular" : "cell-secondary"}>
          {user.phone_number || "未提供"}
        </span>
      ),
    },
    {
      key: "identity",
      title: "身份",
      width: "13%",
      render: (user) =>
        user.is_match_admin ? (
          <StatusBadge label="比赛管理员" variant="info" />
        ) : (
          <span className="cell-secondary">普通用户</span>
        ),
    },
    {
      key: "status",
      title: "账号状态",
      width: "10%",
      render: (user) => (
        <StatusBadge
          label={user.status === "active" ? "正常" : "已冻结"}
          variant={user.status === "active" ? "success" : "destructive"}
        />
      ),
    },
    {
      key: "last_active_at",
      title: (
        <SortHeader
          ariaLabel="切换最近活跃排序"
          direction={sortDirection("last_active")}
          label="最近活跃"
          onToggle={() => onSort("last_active")}
        />
      ),
      width: "19%",
      render: (user) => (
        <ActivityCell lastActiveAt={user.last_active_at} showStatus={false} />
      ),
    },
    {
      key: "created_at",
      title: (
        <SortHeader
          ariaLabel="切换注册时间排序"
          direction={sortDirection("created")}
          label="注册时间"
          onToggle={() => onSort("created")}
        />
      ),
      width: "15%",
      render: (user) => <DateTimeCell value={user.created_at} />,
    },
  ];
  return (
    <DataTable
      className="user-directory-table"
      columns={columns}
      emptyText={
        filtered ? "没有符合筛选条件的用户，可重置筛选后查看" : "暂无微信用户"
      }
      items={users}
      layout="fixed"
      loading={loading}
      rowKey={(user) => String(user.id)}
      scrollable
    />
  );
}
