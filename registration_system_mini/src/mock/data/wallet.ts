import type { AppWalletAccount } from "@/types/wallet";

/** 我的页面钱包卡片使用的 Go 钱包账户 mock */
export const mockWalletAccount: AppWalletAccount = {
  user_id: 37,
  balance_cents: 12800,
  total_recharged_cents: 50000,
  total_spent_cents: 37200,
  version: 3,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};
