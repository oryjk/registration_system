import {
  Alert,
  Form,
  type FormInstance,
  Input,
  InputNumber,
  Modal,
} from "antd";
import type { TeamMember } from "../../types/team";
import { displayMemberName } from "./team-member-display";

export interface CreditTeamFundFormValues {
  amountYuan: number;
  note: string;
}

/** 单笔手动充值上限（元），与后端 teamfund.AdminCreditService 的上限保持一致。 */
export const MAX_CREDIT_YUAN = 10000;

interface CreditTeamFundModalProps {
  member: TeamMember | null;
  form: FormInstance<CreditTeamFundFormValues>;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
  onClose: () => void;
}

function formatYuan(cents: number) {
  return (cents / 100).toFixed(2);
}

export function CreditTeamFundModal({
  member,
  form,
  submitting,
  error,
  onSubmit,
  onClose,
}: CreditTeamFundModalProps) {
  return (
    <Modal
      title={member ? `队费充值 · ${displayMemberName(member)}` : "队费充值"}
      open={Boolean(member)}
      okText="充值"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={onSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      {error ? (
        <Alert className="modal-alert" type="error" showIcon message={error} />
      ) : null}
      {member ? (
        <p className="credit-current-balance">
          当前队费余额：
          {member.balance_cents < 0 ? (
            <strong className="credit-balance-debt">
              欠款 ¥{formatYuan(-member.balance_cents)}
            </strong>
          ) : (
            <strong>¥{formatYuan(member.balance_cents)}</strong>
          )}
          <span className="credit-current-hint">
            （充值金额会直接追加到该余额）
          </span>
        </p>
      ) : null}
      <Form<CreditTeamFundFormValues> form={form} layout="vertical">
        <Form.Item
          name="amountYuan"
          label="充值金额（元）"
          rules={[
            { required: true, message: "请输入充值金额" },
            {
              validator: (_rule, value: number) =>
                !Number.isFinite(value) || value <= 0
                  ? Promise.reject(new Error("充值金额需要大于 0"))
                  : value > MAX_CREDIT_YUAN
                    ? Promise.reject(
                        new Error(
                          `单笔手动充值不能超过 ¥${MAX_CREDIT_YUAN.toLocaleString("zh-CN")}，更大金额请拆分多笔`,
                        ),
                      )
                    : Promise.resolve(),
            },
          ]}
        >
          <InputNumber
            className="credit-amount-input"
            min={0.01}
            max={MAX_CREDIT_YUAN}
            precision={2}
            step={10}
            addonBefore="¥"
            placeholder="例如 100"
          />
        </Form.Item>
        <Form.Item
          name="note"
          label="备注（可选）"
          rules={[{ max: 120, message: "备注不能超过 120 个字符" }]}
        >
          <Input allowClear placeholder="例如：线下现金收款" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
