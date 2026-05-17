import { describe, expect, test } from "bun:test";
import {
  clearLocalSessionStorage,
  getAccessToken,
  getCurrentIdentitySelection,
  getCurrentTeamId,
  setAccessToken,
  setCurrentIdentitySelection,
  setCurrentTeamId,
} from "../authStorage";

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

describe("clearLocalSessionStorage", () => {
  test("removes token, current team and current identity together", () => {
    setAccessToken("token-123");
    setCurrentTeamId(42);
    setCurrentIdentitySelection({ kind: "team", teamId: 42 });

    clearLocalSessionStorage();

    expect(getAccessToken()).toEqual("");
    expect(getCurrentTeamId()).toEqual(null);
    expect(getCurrentIdentitySelection()).toEqual(null);
  });
});
