import Alert from "antd/es/alert";
import Form, { type FormInstance } from "antd/es/form";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import Segmented from "antd/es/segmented";
import Select from "antd/es/select";
import type {
  AssignableTeamMemberRole,
  TeamMember,
  TeamMemberStatus,
} from "../../types/team";
import {
  assignableRoleOptions,
  displayMemberName,
} from "./team-member-display";

export interface EditMemberFormValues {
  realName: string;
  phoneNumber: string;
  role: AssignableTeamMemberRole;
  status: TeamMemberStatus;
}

interface EditTeamMemberModalProps {
  member: TeamMember | null;
  form: FormInstance<EditMemberFormValues>;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
  onClose: () => void;
}

export function EditTeamMemberModal({
  member,
  form,
  submitting,
  error,
  onSubmit,
  onClose,
}: EditTeamMemberModalProps) {
  return (
    <Modal
      title={member ? `编辑${displayMemberName(member)}` : "编辑成员"}
      open={Boolean(member)}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={onSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      {error ? (
        <Alert className="modal-alert" type="error" showIcon message={error} />
      ) : null}
      <Form<EditMemberFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
      >
        <Form.Item
          name="realName"
          label="真实姓名"
          rules={[{ max: 120, message: "真实姓名不能超过 120 个字符" }]}
        >
          <Input allowClear placeholder="未填写" autoComplete="name" />
        </Form.Item>
        <Form.Item
          name="phoneNumber"
          label="手机号"
          rules={[{ max: 32, message: "手机号不能超过 32 个字符" }]}
        >
          <Input
            allowClear
            placeholder="未填写"
            inputMode="tel"
            autoComplete="tel"
          />
        </Form.Item>
        <Form.Item name="role" label="成员角色" rules={[{ required: true }]}>
          <Select options={assignableRoleOptions} />
        </Form.Item>
        <Form.Item name="status" label="成员状态" rules={[{ required: true }]}>
          <Segmented
            block
            options={[
              { label: "启用", value: "active" },
              { label: "冻结", value: "inactive" },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
