export interface MiniReviewStatusItem {
  id: number;
  project_code: string;
  version: string;
  version_code: number;
  is_reviewing: boolean;
  status_text: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface MiniReviewStatusPage {
  items: MiniReviewStatusItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface MiniReviewStatusQuery {
  project_code?: string;
  page?: number;
  page_size?: number;
}

export interface MiniReviewSetStatusPayload {
  is_reviewing: boolean;
  status_text: string;
}
