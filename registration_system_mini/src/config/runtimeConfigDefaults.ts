import type { BackendMiniAppRuntimeConfig } from "@/types/backend";

export const defaultMiniAppRuntimeConfig: BackendMiniAppRuntimeConfig = {
  home: {
    match_card_limit: 2,
    challenge_card_limit: 2,
    activity_fetch_page_size: 100,
    hide_matches_after_holding_time: true,
    hero_banners: [
      {
        title: "约球开踢",
        subtitle: "组队 · 报名 · 上场",
        button_text: "去看看",
        image_url: "",
        enabled: true,
        sort_order: 1,
      },
    ],
  },
  matches: {
    related_activity_limit: 2,
    participant_avatar_limit: 5,
    capacity_extra_slots: 2,
  },
  checkin: {
    default_radius_meters: 200,
    default_open_minutes_before: 60,
    default_close_minutes_after: 45,
  },
  billing: {
    recent_order_limit: 10,
  },
  notifications: {
    list_limit: 50,
  },
  profile: {
    require_phone_binding: false,
  },
};
