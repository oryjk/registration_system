import { Alert, Form, type FormInstance, Input, Modal, Select } from "antd";
import type {
  AssignableTeamMemberRole,
  TeamMemberCandidate,
} from "../../types/team";
import { assignableRoleOptions } from "./team-member-display";

export interface AddMemberFormValues {
  userID: number;
  role: AssignableTeamMemberRole;
}

interface AddTeamMemberModalProps {
  open: boolean;
  form: FormInstance<AddMemberFormValues>;
  candidates: TeamMemberCandidate[];
  loadingCandidates: boolean;
  submitting: boolean;
  error: string;
  onSearch: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function AddTeamMemberModal({
  open,
  form,
  candidates,
  loadingCandidates,
  submitting,
  error,
  onSearch,
  onSubmit,
  onClose,
}: AddTeamMemberModalProps) {
  return (
    <Modal
      title="添加球队成员"
      open={open}
      okText="添加"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={onSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      {error ? (
        <Alert className="modal-alert" type="error" showIcon message={error} />
      ) : null}
      <Form<AddMemberFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={submitting}
      >
        <Form.Item label="查询球员">
          <Input.Search
            allowClear
            enterButton="查询"
            placeholder="输入姓名、昵称、手机号或用户 ID"
            loading={loadingCandidates}
            onSearch={onSearch}
          />
        </Form.Item>
        <Form.Item
          name="userID"
          label="选择球员"
          rules={[{ required: true, message: "请选择需要添加的球员" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={loadingCandidates}
            placeholder={loadingCandidates ? "正在加载候选球员" : "请选择球员"}
            notFoundContent={loadingCandidates ? null : "没有可添加的球员"}
            options={candidates.map((candidate) => ({
              value: candidate.user_id,
              label: `${candidate.real_name?.trim() || candidate.nickname.trim() || "未设置姓名"}${candidate.phone_number ? ` · ${candidate.phone_number}` : ""} · ID ${candidate.user_id}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="role" label="成员角色" rules={[{ required: true }]}>
          <Select options={assignableRoleOptions} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
