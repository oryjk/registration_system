export interface TipItem {
  order_no: string;
  user_id: number;
  nickname: string;
  amount_cents: number;
  suggestion: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

export interface TipListQuery {
  page: number;
  page_size: number;
}

export interface TipListPage {
  items: TipItem[];
  total: number;
  page: number;
  page_size: number;
}
