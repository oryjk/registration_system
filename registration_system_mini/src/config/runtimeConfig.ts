import { getMiniAppRuntimeConfig } from "@/api/system";
import type { BackendMiniAppRuntimeConfig } from "@/types/backend";
import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfigDefaults";

export { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfigDefaults";

export type MiniAppRuntimeConfig = BackendMiniAppRuntimeConfig;

type RuntimeConfigInput = Partial<{
  home: Partial<MiniAppRuntimeConfig["home"]>;
  matches: Partial<MiniAppRuntimeConfig["matches"]>;
  checkin: Partial<MiniAppRuntimeConfig["checkin"]>;
  billing: Partial<MiniAppRuntimeConfig["billing"]>;
  notifications: Partial<MiniAppRuntimeConfig["notifications"]>;
  profile: Partial<MiniAppRuntimeConfig["profile"]>;
  debug: Partial<MiniAppRuntimeConfig["debug"]>;
}>;

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.round(numberValue), min), max);
}

function truncateText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : fallback;
  return Array.from(text).slice(0, maxLength).join("");
}

function sanitizeHomeHeroBanners(value: unknown) {
  const defaults = defaultMiniAppRuntimeConfig.home.hero_banners;
  if (!Array.isArray(value)) return defaults;

  const banners = value
    .map((item, index) => {
      const banner = item as Partial<MiniAppRuntimeConfig["home"]["hero_banners"][number]>;
      const title = truncateText(banner.title, "", 20);
      if (!title) return null;
      return {
        title,
        subtitle: truncateText(banner.subtitle, "", 30),
        button_text: truncateText(banner.button_text, "去看看", 10) || "去看看",
        image_url: truncateText(banner.image_url, "", 512),
        enabled: typeof banner.enabled === "boolean" ? banner.enabled : true,
        sort_order: clampNumber(banner.sort_order, index + 1, -32768, 32767),
      };
    })
    .filter((banner): banner is MiniAppRuntimeConfig["home"]["hero_banners"][number] => Boolean(banner))
    .slice(0, 10)
    .sort((left, right) => left.sort_order - right.sort_order);

  return banners.length > 0 ? banners : defaults;
}

export function sanitizeMiniAppRuntimeConfig(input?: RuntimeConfigInput | null): MiniAppRuntimeConfig {
  const defaults = defaultMiniAppRuntimeConfig;
  return {
    home: {
      match_card_limit: clampNumber(input?.home?.match_card_limit, defaults.home.match_card_limit, 1, 10),
      challenge_card_limit: clampNumber(input?.home?.challenge_card_limit, defaults.home.challenge_card_limit, 1, 10),
      activity_fetch_page_size: clampNumber(input?.home?.activity_fetch_page_size, defaults.home.activity_fetch_page_size, 20, 100),
      hide_matches_after_holding_time:
        typeof input?.home?.hide_matches_after_holding_time === "boolean"
          ? input.home.hide_matches_after_holding_time
          : defaults.home.hide_matches_after_holding_time,
      hero_banners: sanitizeHomeHeroBanners(input?.home?.hero_banners),
    },
    matches: {
      related_activity_limit: clampNumber(input?.matches?.related_activity_limit, defaults.matches.related_activity_limit, 1, 10),
      participant_avatar_limit: clampNumber(input?.matches?.participant_avatar_limit, defaults.matches.participant_avatar_limit, 1, 10),
      capacity_extra_slots: clampNumber(input?.matches?.capacity_extra_slots, defaults.matches.capacity_extra_slots, 0, 20),
    },
    checkin: {
      default_radius_meters: clampNumber(input?.checkin?.default_radius_meters, defaults.checkin.default_radius_meters, 50, 5000),
      default_open_minutes_before: clampNumber(input?.checkin?.default_open_minutes_before, defaults.checkin.default_open_minutes_before, 0, 1440),
      default_close_minutes_after: clampNumber(input?.checkin?.default_close_minutes_after, defaults.checkin.default_close_minutes_after, 0, 1440),
    },
    billing: {
      recent_order_limit: clampNumber(input?.billing?.recent_order_limit, defaults.billing.recent_order_limit, 1, 50),
    },
    notifications: {
      list_limit: clampNumber(input?.notifications?.list_limit, defaults.notifications.list_limit, 1, 100),
    },
    profile: {
      require_phone_binding:
        typeof input?.profile?.require_phone_binding === "boolean"
          ? input.profile.require_phone_binding
          : defaults.profile.require_phone_binding,
    },
    debug: {
      clear_profile_enabled:
        typeof input?.debug?.clear_profile_enabled === "boolean"
          ? input.debug.clear_profile_enabled
          : defaults.debug.clear_profile_enabled,
    },
  };
}

export async function loadMiniAppRuntimeConfig() {
  try {
    return sanitizeMiniAppRuntimeConfig(await getMiniAppRuntimeConfig());
  } catch (_error) {
    return defaultMiniAppRuntimeConfig;
  }
}

export function parseRuntimeDateTime(value: string) {
  return new Date(value.replace(" ", "T")).getTime();
}

export function isRuntimeVisibleActivity(
  activity: { holding_date: string; status?: number | null },
  config: MiniAppRuntimeConfig,
  now: Date = new Date(),
) {
  if (activity.status === 2 || activity.status === 3) {
    return false;
  }
  if (!config.home.hide_matches_after_holding_time) {
    return true;
  }
  return parseRuntimeDateTime(activity.holding_date) > now.getTime();
}

export function isRuntimeVisibleChallengeSummary(
  summary: { challenge: { holding_date: string; status?: string | null } },
  config: MiniAppRuntimeConfig,
  now: Date = new Date(),
) {
  if (summary.challenge.status === "cancelled") {
    return false;
  }
  if (!config.home.hide_matches_after_holding_time) {
    return true;
  }
  return parseRuntimeDateTime(summary.challenge.holding_date) > now.getTime();
}
