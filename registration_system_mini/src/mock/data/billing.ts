import type {
  BackendBillingFlowResult,
  BackendPaymentOrder,
  BackendUserAccount,
} from "@/types/backend";

export const mockUserAccount: BackendUserAccount = {
  user_id: 37,
  balance: "286.00",
  total_recharge: "620.00",
  total_expense: "334.00",
  total_penalty: "0.00",
};

export const mockBillingFlow: BackendBillingFlowResult = {
  final_balance: mockUserAccount.balance,
  records: [
    {
      id: "bill-003",
      record_type: "activity_expense",
      type_name: "比赛费用",
      amount: "-48.00",
      description: "周三晚间 6 人制报名费",
      activity_id: "act-001",
      created_at: "2026-08-07 21:10:00",
      balance: "286.00",
    },
    {
      id: "bill-002",
      record_type: "activity_expense",
      type_name: "比赛费用",
      amount: "-68.00",
      description: "城市杯小组赛报名费",
      activity_id: "act-002",
      created_at: "2026-08-03 19:30:00",
      balance: "334.00",
    },
    {
      id: "bill-001",
      record_type: "recharge",
      type_name: "账户充值",
      amount: "+200.00",
      description: "微信充值",
      activity_id: null,
      created_at: "2026-08-01 10:08:00",
      balance: "402.00",
    },
  ],
};

export const mockPaymentOrders: BackendPaymentOrder[] = [
  {
    order_no: "MOCK-20260807-001",
    user_id: mockUserAccount.user_id,
    amount: "48.00",
    order_type: "activity",
    status: "paid",
    prepay_id: "mock-prepay-activity",
    transaction_id: "mock-transaction-activity",
    description: "周三晚间 6 人制报名费",
  },
  {
    order_no: "MOCK-20260801-001",
    user_id: mockUserAccount.user_id,
    amount: "200.00",
    order_type: "recharge",
    status: "paid",
    prepay_id: "mock-prepay-recharge",
    transaction_id: "mock-transaction-recharge",
    description: "钱包充值",
  },
];
