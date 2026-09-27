import { describe, expect, test } from "bun:test";
import {
  clearOnboardingIntent,
  getOnboardingIntent,
  isOnboardingGuideDismissed,
  markOnboardingGuideDismissed,
  setOnboardingIntent,
} from "../onboardingGuideStorage";

const storage = new Map<string, unknown>();

(globalThis as typeof globalThis & { uni: UniApp.Uni }).uni = {
  getStorageSync: (key: string) => storage.get(key) ?? "",
  setStorageSync: (key: string, value: unknown) => {
    storage.set(key, value);
  },
  removeStorageSync: (key: string) => {
    storage.delete(key);
  },
} as UniApp.Uni;

describe("onboardingGuideStorage", () => {
  test("defaults to empty state for each user", () => {
    storage.clear();

    expect(isOnboardingGuideDismissed(101)).toEqual(false);
    expect(isOnboardingGuideDismissed(202)).toEqual(false);
    expect(getOnboardingIntent(101)).toEqual(null);
    expect(getOnboardingIntent(202)).toEqual(null);
  });

  test("dismissed state is isolated by user id", () => {
    storage.clear();

    markOnboardingGuideDismissed(101);

    expect(isOnboardingGuideDismissed(101)).toEqual(true);
    expect(isOnboardingGuideDismissed(202)).toEqual(false);
  });

  test("captain or player intent is isolated by user id", () => {
    storage.clear();

    setOnboardingIntent(101, "captain");
    setOnboardingIntent(202, "player");

    expect(getOnboardingIntent(101)).toEqual("captain");
    expect(getOnboardingIntent(202)).toEqual("player");
  });

  test("ignores legacy device-wide onboarding keys instead of assigning them to a new user", () => {
    storage.clear();
    storage.set("registration_system_mini_onboarding_intent_v1", "captain");
    storage.set("registration_system_mini_onboarding_guide_dismissed_v1", "1");

    expect(getOnboardingIntent(101)).toEqual(null);
    expect(isOnboardingGuideDismissed(101)).toEqual(false);
  });

  test("does not read or persist onboarding state without a logged-in user id", () => {
    storage.clear();

    setOnboardingIntent(null, "captain");
    markOnboardingGuideDismissed(null);

    expect(getOnboardingIntent(null)).toEqual(null);
    expect(isOnboardingGuideDismissed(null)).toEqual(false);
    expect(storage.size).toEqual(0);
  });

  test("clears only the completed user's intent and leaves other users untouched", () => {
    storage.clear();
    setOnboardingIntent(101, "captain");
    setOnboardingIntent(202, "player");
    markOnboardingGuideDismissed(101);

    clearOnboardingIntent(101);

    expect(getOnboardingIntent(101)).toEqual(null);
    expect(getOnboardingIntent(202)).toEqual("player");
    // 清 intent 不代表重新开启已跳过的新手弹窗。
    expect(isOnboardingGuideDismissed(101)).toEqual(true);
  });

  test("ignores stale or unknown values in a user-scoped key", () => {
    storage.clear();
    storage.set("registration_system_mini_onboarding_intent_v2:101", "manager");

    expect(getOnboardingIntent(101)).toEqual(null);
  });
});
