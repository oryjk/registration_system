import CrownOutlined from "@ant-design/icons/es/icons/CrownOutlined";
import DeleteOutlined from "@ant-design/icons/es/icons/DeleteOutlined";
import EditOutlined from "@ant-design/icons/es/icons/EditOutlined";
import ProTable, { type ProColumns } from "@ant-design/pro-components/es/table";
import Avatar from "antd/es/avatar";
import Button from "antd/es/button";
import Empty from "antd/es/empty";
import Popconfirm from "antd/es/popconfirm";
import Space from "antd/es/space";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import type { TeamMember } from "../../types/team";
import {
  displayMemberName,
  memberInitial,
  roleColors,
  roleLabels,
  statusLabels,
} from "./team-member-display";

const { Text } = Typography;

interface TeamMemberTableProps {
  members: TeamMember[];
  loading: boolean;
  compact: boolean;
  actionKey: string;
  onEdit: (member: TeamMember) => void;
  onCaptainChange: (member: TeamMember, captain: boolean) => void;
  onRemove: (member: TeamMember) => void;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function TeamMemberTable({
  members,
  loading,
  compact,
  actionKey,
  onEdit,
  onCaptainChange,
  onRemove,
}: TeamMemberTableProps) {
  const columns: ProColumns<TeamMember>[] = [
    {
      title: "成员",
      key: "member",
      render: (_, member) => (
        <div className="member-identity">
          <Avatar src={member.avatar_url} size={36}>
            {memberInitial(member)}
          </Avatar>
          <div>
            <strong>{displayMemberName(member)}</strong>
            <Text type="secondary">
              {member.nickname.trim() &&
              member.nickname.trim() !== displayMemberName(member)
                ? `${member.nickname.trim()} · `
                : ""}
              用户 ID {member.user_id}
            </Text>
            {member.phone_number ? (
              <Text type="secondary">{member.phone_number}</Text>
            ) : null}
            {compact ? (
              <Space size={4} wrap>
                <Tag color={roleColors[member.role]}>
                  {roleLabels[member.role]}
                </Tag>
                <Tag color={member.status === "active" ? "success" : "warning"}>
                  {statusLabels[member.status]}
                </Tag>
              </Space>
            ) : null}
          </div>
        </div>
      ),
    },
    ...(compact
      ? []
      : [
          {
            title: "角色",
            dataIndex: "role",
            width: 100,
            render: (_: unknown, member: TeamMember) => (
              <Tag color={roleColors[member.role]}>
                {roleLabels[member.role]}
              </Tag>
            ),
          },
          {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (_: unknown, member: TeamMember) => (
              <Tag color={member.status === "active" ? "success" : "warning"}>
                {statusLabels[member.status]}
              </Tag>
            ),
          },
          {
            title: "加入时间",
            dataIndex: "joined_at",
            width: 126,
            renderText: formatDate,
          },
        ]),
    {
      title: "操作",
      key: "actions",
      valueType: "option",
      width: compact ? 124 : 138,
      fixed: "right",
      render: (_, member) => {
        const isCaptain = member.role === "captain";
        const memberName = displayMemberName(member);
        const captainTitle = isCaptain
          ? "取消队长"
          : member.status === "active"
            ? "设为队长"
            : "冻结成员不能设为队长";
        return (
          <Space size={0}>
            <Popconfirm
              title={
                isCaptain
                  ? `取消${memberName}的队长身份`
                  : `将${memberName}设为队长`
              }
              description={
                isCaptain
                  ? "取消后该成员将恢复为普通队员。"
                  : "原队长将自动恢复为普通队员。"
              }
              okText="确认"
              cancelText="返回"
              disabled={!isCaptain && member.status !== "active"}
              onConfirm={() => onCaptainChange(member, !isCaptain)}
            >
              <Tooltip title={compact ? undefined : captainTitle}>
                <Button
                  type="text"
                  shape="circle"
                  className={`captain-action${isCaptain ? " captain-action-current" : ""}`}
                  disabled={!isCaptain && member.status !== "active"}
                  loading={actionKey === `captain-${member.user_id}`}
                  icon={<CrownOutlined />}
                  aria-label={`${isCaptain ? "取消" : "设置"}${memberName}为队长`}
                />
              </Tooltip>
            </Popconfirm>
            <Tooltip
              title={
                compact
                  ? undefined
                  : isCaptain
                    ? "请先取消或更换队长"
                    : "编辑成员"
              }
            >
              <Button
                type="text"
                shape="circle"
                disabled={isCaptain}
                loading={actionKey === `edit-${member.user_id}`}
                icon={<EditOutlined />}
                aria-label={`编辑${memberName}`}
                onClick={() => onEdit(member)}
              />
            </Tooltip>
            <Popconfirm
              title={`移除${memberName}`}
              description="移除后可通过候选球员重新添加。"
              okText="移除"
              okButtonProps={{ danger: true }}
              cancelText="返回"
              disabled={isCaptain}
              onConfirm={() => onRemove(member)}
            >
              <Button
                type="text"
                shape="circle"
                danger
                disabled={isCaptain}
                loading={actionKey === `remove-${member.user_id}`}
                icon={<DeleteOutlined />}
                aria-label={`移除${memberName}`}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <ProTable<TeamMember>
      className="member-table"
      rowKey="id"
      search={false}
      options={false}
      cardProps={false}
      loading={loading}
      dataSource={members}
      columns={columns}
      pagination={
        members.length > 20 ? { pageSize: 20, showSizeChanger: false } : false
      }
      scroll={{ x: compact ? 560 : 680 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无球队成员"
          />
        ),
      }}
    />
  );
}
