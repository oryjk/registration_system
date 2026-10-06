import { useId, useRef, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ErrorAlert } from "@/components/admin/error-alert";
import { MemberCell } from "@/components/admin/member-cell";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUpdateMatchRegistrationMutation } from "@/hooks/queries/useMatchQueries";
import type {
  EditableMatchRegistrationStatus,
  MatchRegistrationEntry,
  MatchStatus,
  RegistrationGroup,
} from "@/types/match";
import {
  registrationStatusColors,
  registrationStatusLabels,
} from "../matchLabels";

const editableStatuses: EditableMatchRegistrationStatus[] = [
  "unknown",
  "attending",
  "leave",
  "absent",
];
const memberRoleLabels: Record<string, string> = {
  captain: "队长",
  leader: "领队",
  vice_captain: "副队长",
  member: "队员",
};
const memberName = (record: MatchRegistrationEntry) =>
  record.nickname || `用户 ${record.user_id}`;

function RegistrationStatusOptions({
  record,
  disabled,
  onSelect,
}: {
  record: MatchRegistrationEntry;
  disabled: boolean;
  onSelect: (status: EditableMatchRegistrationStatus) => void;
}) {
  const id = useId();
  return (
    <div className="registration-state-field">
      {(record.status === "unregistered" || record.status === "cancelled") && (
        <StatusBadge
          label={registrationStatusLabels[record.status]}
          variant={registrationStatusColors[record.status]}
        />
      )}
      <RadioGroup
        aria-label={`${memberName(record)}的报名状态`}
        className="registration-state-options"
        disabled={disabled}
        value={record.status}
        onValueChange={(value) => {
          const status = editableStatuses.find((option) => option === value);
          if (status && status !== record.status) onSelect(status);
        }}
      >
        {editableStatuses.map((status) => (
          <div className="registration-state-option" key={status}>
            <RadioGroupItem id={`${id}-${status}`} value={status} />
            <Label htmlFor={`${id}-${status}`}>
              {registrationStatusLabels[status]}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export function MatchRegistrationRoster({
  matchId,
  matchStatus,
  group,
}: {
  matchId: string;
  matchStatus: MatchStatus;
  group: RegistrationGroup;
}) {
  const mutation = useUpdateMatchRegistrationMutation();
  const [selection, setSelection] = useState<{
    record: MatchRegistrationEntry;
    status: EditableMatchRegistrationStatus;
  } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const teamGroup = group.kind !== "individual_opponent";
  const disabled =
    matchStatus === "cancelled" ||
    group.status === "cancelled" ||
    mutation.isPending;

  function closeConfirmation() {
    if (mutation.isPending) return;
    setSelection(null);
    mutation.reset();
  }

  async function confirmSelection() {
    if (!selection || disabled) return;
    try {
      await mutation.mutateAsync({
        matchId,
        groupId: group.id,
        userId: selection.record.user_id,
        status: selection.status,
      });
      setSelection(null);
    } catch {
      // mutation.error 在确认框中展示；保留已保存状态，允许重试或取消。
    }
  }

  const columns: DataTableColumn<MatchRegistrationEntry>[] = [
    {
      key: "nickname",
      title: "队员",
      render: (record) => (
        <MemberCell
          avatarUrl={record.avatar_url}
          name={memberName(record)}
          secondary={record.real_name || undefined}
        />
      ),
    },
  ];
  if (teamGroup)
    columns.push({
      key: "member_role",
      title: "角色",
      render: (record) =>
        record.member_role
          ? memberRoleLabels[record.member_role] || record.member_role
          : "--",
    });
  columns.push({
    key: "status",
    title: "报名状态",
    render: (record) =>
      teamGroup ? (
        <RegistrationStatusOptions
          record={record}
          disabled={disabled}
          onSelect={(status) => {
            mutation.reset();
            setSelection({ record, status });
          }}
        />
      ) : (
        <StatusBadge
          label={registrationStatusLabels[record.status]}
          variant={registrationStatusColors[record.status]}
        />
      ),
  });
  if (!teamGroup)
    columns.push(
      {
        key: "registration_count",
        title: "人数",
        render: (record) =>
          record.registration_count > 1 ? (
            <StatusBadge
              label={`×${record.registration_count}`}
              variant="info"
            />
          ) : (
            <span className="cell-secondary">1</span>
          ),
      },
      {
        key: "paid",
        title: "支付",
        render: (record) => (
          <StatusBadge
            label={record.paid ? "已付" : "未付"}
            variant={record.paid ? "success" : "secondary"}
          />
        ),
      },
    );

  return (
    <>
      <DataTable
        columns={columns}
        items={group.registrations}
        loading={false}
        rowKey={(record) => String(record.user_id)}
        emptyText="暂无报名记录"
      />
      <Dialog
        open={Boolean(selection)}
        onOpenChange={(open) => {
          if (!open) closeConfirmation();
        }}
      >
        <DialogContent
          showCloseButton={!mutation.isPending}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>确认修改报名状态</DialogTitle>
            <DialogDescription>
              确认将 {selection ? memberName(selection.record) : ""}{" "}
              的报名状态修改为以下状态？
            </DialogDescription>
          </DialogHeader>
          {selection && (
            <p className="registration-state-change">
              {registrationStatusLabels[selection.record.status]} →{" "}
              {registrationStatusLabels[selection.status]}
            </p>
          )}
          {mutation.error && (
            <ErrorAlert
              message={
                mutation.error instanceof Error
                  ? mutation.error.message
                  : "修改报名状态失败"
              }
            />
          )}
          <DialogFooter>
            <Button
              ref={cancelRef}
              variant="outline"
              disabled={mutation.isPending}
              onClick={closeConfirmation}
            >
              取消
            </Button>
            <Button disabled={disabled} onClick={confirmSelection}>
              {mutation.isPending ? "保存中…" : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
