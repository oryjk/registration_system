import type {
  BackendPaymentOrder,
  BackendPaymentOrderListResult,
  BackendTeamFundBalance,
  BackendTeamFundTransaction,
} from "@/types/backend";

export const mockTeamFundBalances: BackendTeamFundBalance[] = [
  { team_id: 3, team_name: "周三球局常驻队", balance_cents: 28600 },
  { team_id: 7, team_name: "城市杯联队", balance_cents: -3400 },
];

export const mockTeamFundTransactions: BackendTeamFundTransaction[] = [
  {
    id: 3003,
    team_id: 3,
    team_name: "周三球局常驻队",
    amount_cents: -4800,
    balance_after_cents: 28600,
    source: "match_settlement",
    match_id: "act-001",
    match_name: "周三晚间 6 人制",
    description: "赛后队费扣款",
    created_at: "2026-08-07 21:10:00",
  },
  {
    id: 3002,
    team_id: 7,
    team_name: "城市杯联队",
    amount_cents: -6800,
    balance_after_cents: -3400,
    source: "match_settlement",
    match_id: "act-002",
    match_name: "城市杯小组赛",
    description: "赛后队费扣款",
    created_at: "2026-08-03 19:30:00",
  },
  {
    id: 3001,
    team_id: 3,
    team_name: "周三球局常驻队",
    amount_cents: 20000,
    balance_after_cents: 33400,
    source: "membership_payment",
    match_id: null,
    match_name: null,
    description: "队费充值",
    created_at: "2026-08-01 10:08:00",
  },
];

export const mockPaymentOrders: BackendPaymentOrderListResult = {
  total: 2,
  page: 1,
  page_size: 10,
  items: [
    {
      order_no: "MOCK-20260807-001",
      user_id: 37,
      amount_cents: 4800,
      provider: "wechat",
      channel: "jsapi",
      kind: "match_registration",
      team_id: null,
      match_id: "act-001",
      months: null,
      status: "paid",
      paid_at: "2026-08-07 21:05:00",
      created_at: "2026-08-07 21:04:00",
      updated_at: "2026-08-07 21:05:00",
    },
    {
      order_no: "MOCK-20260801-001",
      user_id: 37,
      amount_cents: 20000,
      provider: "wechat",
      channel: "jsapi",
      kind: "team_membership",
      team_id: 3,
      match_id: null,
      months: null,
      status: "paid",
      paid_at: "2026-08-01 10:09:00",
      created_at: "2026-08-01 10:08:00",
      updated_at: "2026-08-01 10:09:00",
    },
  ],
};
