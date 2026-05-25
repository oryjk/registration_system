import { describe, expect, test } from "bun:test";
import {
  defaultMiniAppRuntimeConfig,
  isRuntimeVisibleChallengeSummary,
  isRuntimeVisibleActivity,
  sanitizeMiniAppRuntimeConfig,
} from "../runtimeConfig";

describe("mini app runtime config", () => {
  test("clamps numeric values and preserves defaults for missing sections", () => {
    const config = sanitizeMiniAppRuntimeConfig({
      home: {
        match_card_limit: 99,
        challenge_card_limit: 0,
        activity_fetch_page_size: 5,
        hide_matches_after_holding_time: false,
      },
      matches: {
        related_activity_limit: 20,
        participant_avatar_limit: 0,
        capacity_extra_slots: 30,
      },
    });

    expect(config.home.match_card_limit).toEqual(10);
    expect(config.home.challenge_card_limit).toEqual(1);
    expect(config.home.activity_fetch_page_size).toEqual(20);
    expect(config.home.hide_matches_after_holding_time).toEqual(false);
    expect(config.home.hero_banners[0]?.title).toEqual("约球开踢");
    expect(config.matches.related_activity_limit).toEqual(10);
    expect(config.matches.participant_avatar_limit).toEqual(1);
    expect(config.matches.capacity_extra_slots).toEqual(20);
    expect(config.checkin).toEqual(defaultMiniAppRuntimeConfig.checkin);
    expect(config.profile.require_phone_binding).toEqual(false);
  });

  test("keeps profile phone binding hidden by default and accepts backend opt-in", () => {
    expect(defaultMiniAppRuntimeConfig.profile.require_phone_binding).toEqual(false);
    expect(sanitizeMiniAppRuntimeConfig({}).profile.require_phone_binding).toEqual(false);
    expect(
      sanitizeMiniAppRuntimeConfig({
        profile: {
          require_phone_binding: true,
        },
      }).profile.require_phone_binding,
    ).toEqual(true);
  });

  test("sanitizes home hero banners and keeps a default fallback", () => {
    const config = sanitizeMiniAppRuntimeConfig({
      home: {
        ...defaultMiniAppRuntimeConfig.home,
        hero_banners: [
          {
            title: "  球队约战  ",
            subtitle: "  找对手 · 约时间  ",
            button_text: "  ",
            image_url: " https://example.com/team.png ",
            enabled: true,
            sort_order: 2,
          },
          {
            title: "散人开局",
            subtitle: "缺人就来",
            button_text: "报名",
            image_url: "",
            enabled: false,
            sort_order: 1,
          },
          {
            title: "   ",
            subtitle: "ignore",
            button_text: "查看",
            image_url: "",
            enabled: true,
            sort_order: 3,
          },
        ],
      },
    });

    expect(config.home.hero_banners).toEqual([
      {
        title: "散人开局",
        subtitle: "缺人就来",
        button_text: "报名",
        image_url: "",
        enabled: false,
        sort_order: 1,
      },
      {
        title: "球队约战",
        subtitle: "找对手 · 约时间",
        button_text: "去看看",
        image_url: "https://example.com/team.png",
        enabled: true,
        sort_order: 2,
      },
    ]);
  });

  test("hides past matches when configured to hide by holding time", () => {
    const config = sanitizeMiniAppRuntimeConfig({
      home: {
        ...defaultMiniAppRuntimeConfig.home,
        hide_matches_after_holding_time: true,
      },
    });
    const now = new Date("2026-05-11T12:00:00");

    expect(
      isRuntimeVisibleActivity(
        { holding_date: "2026-05-11T11:59:59", status: 0 },
        config,
        now,
      ),
    ).toEqual(false);
    expect(
      isRuntimeVisibleActivity(
        { holding_date: "2026-05-11T12:00:01", status: 0 },
        config,
        now,
      ),
    ).toEqual(true);
  });

  test("keeps old status-only behavior when holding time filtering is disabled", () => {
    const config = sanitizeMiniAppRuntimeConfig({
      home: {
        ...defaultMiniAppRuntimeConfig.home,
        hide_matches_after_holding_time: false,
      },
    });
    const now = new Date("2026-05-11T12:00:00");

    expect(
      isRuntimeVisibleActivity(
        { holding_date: "2026-05-10T12:00:00", status: 0 },
        config,
        now,
      ),
    ).toEqual(true);
    expect(
      isRuntimeVisibleActivity(
        { holding_date: "2026-05-12T12:00:00", status: 2 },
        config,
        now,
      ),
    ).toEqual(false);
  });

  test("applies the same holding time rule to home challenge opportunities", () => {
    const config = sanitizeMiniAppRuntimeConfig({
      home: {
        ...defaultMiniAppRuntimeConfig.home,
        hide_matches_after_holding_time: true,
      },
    });
    const now = new Date("2026-05-11T12:00:00");

    expect(
      isRuntimeVisibleChallengeSummary(
        { challenge: { holding_date: "2026-05-11T11:59:59", status: "open" } },
        config,
        now,
      ),
    ).toEqual(false);
    expect(
      isRuntimeVisibleChallengeSummary(
        { challenge: { holding_date: "2026-05-11T12:00:01", status: "open" } },
        config,
        now,
      ),
    ).toEqual(true);
    expect(
      isRuntimeVisibleChallengeSummary(
        { challenge: { holding_date: "2026-05-12T12:00:00", status: "cancelled" } },
        config,
        now,
      ),
    ).toEqual(false);
  });
});
