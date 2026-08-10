export interface AppWalletAccount {
  user_id: number;
  balance_cents: number;
  total_recharged_cents: number;
  total_spent_cents: number;
  version: number;
  created_at?: string;
  updated_at?: string;
}
