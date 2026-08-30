import { Crown, Pencil, Trash2, Wallet } from "lucide-react";
import { ConfirmPopover } from "@/components/admin/confirm-popover";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { MemberCell } from "@/components/admin/member-cell";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TeamMember } from "@/types/team";
import { formatDate, formatYuanAmount } from "@/utils/format";
import {
  displayMemberName,
  roleColors,
  roleLabels,
  statusLabels,
} from "./team-member-display";

interface TeamMemberTableProps {
  members: TeamMember[];
  loading: boolean;
  actionKey: string;
  onEdit: (member: TeamMember) => void;
  onCredit: (member: TeamMember) => void;
  onCaptainChange: (member: TeamMember, captain: boolean) => void;
  onRemove: (member: TeamMember) => void;
}

export function TeamMemberTable({
  members,
  loading,
  actionKey,
  onEdit,
  onCredit,
  onCaptainChange,
  onRemove,
}: TeamMemberTableProps) {
  const columns: DataTableColumn<TeamMember>[] = [
    {
      key: "member",
      title: "成员",
      render: (member) => (
        <MemberCell
          avatarUrl={member.avatar_url}
          name={displayMemberName(member)}
          secondary={`${
            member.nickname.trim() &&
            member.nickname.trim() !== displayMemberName(member)
              ? `${member.nickname.trim()} · `
              : ""
          }用户 ID ${member.user_id}`}
          size="lg"
          tertiary={member.phone_number || undefined}
        />
      ),
    },
    {
      key: "role",
      title: "角色",
      width: 100,
      render: (member) => (
        <StatusBadge
          label={roleLabels[member.role]}
          variant={roleColors[member.role]}
        />
      ),
    },
    {
      key: "status",
      title: "状态",
      width: 100,
      render: (member) => (
        <StatusBadge
          label={statusLabels[member.status]}
          variant={member.status === "active" ? "success" : "warning"}
        />
      ),
    },
    {
      key: "joined_at",
      title: "加入时间",
      width: 126,
      render: (member) => formatDate(member.joined_at),
    },
    {
      key: "balance_cents",
      title: "队费余额",
      width: 120,
      render: (member) =>
        member.balance_cents < 0 ? (
          <StatusBadge
            label={`欠款 ¥${formatYuanAmount(-member.balance_cents)}`}
            variant="destructive"
          />
        ) : (
          <span>¥{formatYuanAmount(member.balance_cents)}</span>
        ),
    },
    {
      key: "actions",
      title: "操作",
      width: 176,
      render: (member) => {
        const isCaptain = member.role === "captain";
        const memberName = displayMemberName(member);
        return (
          <div className="table-row-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={`给${memberName}充值队费`}
                  disabled={actionKey === `credit-${member.user_id}`}
                  onClick={() => onCredit(member)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Wallet size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>队费充值</TooltipContent>
            </Tooltip>
            <ConfirmPopover
              cancelText="返回"
              confirmText="确认"
              description={
                isCaptain
                  ? "取消后该成员将恢复为普通队员。"
                  : "原队长将自动恢复为普通队员。"
              }
              onConfirm={() => onCaptainChange(member, !isCaptain)}
              title={
                isCaptain
                  ? `取消${memberName}的队长身份`
                  : `将${memberName}设为队长`
              }
            >
              <Button
                aria-label={`${isCaptain ? "取消" : "设置"}${memberName}为队长`}
                className={
                  isCaptain ? "text-warning captain-action-current" : undefined
                }
                disabled={
                  (!isCaptain && member.status !== "active") ||
                  actionKey === `captain-${member.user_id}`
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <Crown size={15} />
              </Button>
            </ConfirmPopover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={`编辑${memberName}`}
                  disabled={isCaptain || actionKey === `edit-${member.user_id}`}
                  onClick={() => onEdit(member)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Pencil size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCaptain ? "请先取消或更换队长" : "编辑成员"}
              </TooltipContent>
            </Tooltip>
            <ConfirmPopover
              cancelText="返回"
              confirmText="移除"
              destructive
              description="移除后可通过候选球员重新添加。"
              onConfirm={() => onRemove(member)}
              title={`移除${memberName}`}
            >
              <Button
                aria-label={`移除${memberName}`}
                className="text-destructive"
                disabled={isCaptain || actionKey === `remove-${member.user_id}`}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 size={15} />
              </Button>
            </ConfirmPopover>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      emptyText="暂无球队成员"
      items={members}
      loading={loading}
      rowKey={(member) => String(member.user_id)}
    />
  );
}
