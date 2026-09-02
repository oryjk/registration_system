import { describe, expect, test } from "bun:test";
import {
  isOnboardingGuideDismissed,
  markOnboardingGuideDismissed,
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
    expect(isOnboardingGuideDismissed()).toEqual(false);
  });

  test("stays dismissed after marking", () => {
    markOnboardingGuideDismissed();

    expect(isOnboardingGuideDismissed()).toEqual(true);
  });
});
