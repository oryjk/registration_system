import { describe, expect, test } from "bun:test";
import {
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
  test("defaults to not dismissed", () => {
    storage.clear();
    expect(isOnboardingGuideDismissed()).toEqual(false);
  });

  test("stays dismissed after marking", () => {
    storage.clear();
    markOnboardingGuideDismissed();

    expect(isOnboardingGuideDismissed()).toEqual(true);
  });

  test("persists the user's captain or player intent", () => {
    storage.clear();
    expect(getOnboardingIntent()).toEqual(null);

    setOnboardingIntent("captain");
    expect(getOnboardingIntent()).toEqual("captain");

    setOnboardingIntent("player");
    expect(getOnboardingIntent()).toEqual("player");
  });

  test("ignores stale or unknown stored intent values", () => {
    storage.clear();
    storage.set("registration_system_mini_onboarding_intent_v1", "manager");

    expect(getOnboardingIntent()).toEqual(null);
  });
});
