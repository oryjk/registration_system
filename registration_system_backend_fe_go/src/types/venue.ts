export interface VenueItem {
  location: string;
  latitude: number | null;
  longitude: number | null;
  use_count: number;
  last_used_at: string;
  image_url: string;
}
