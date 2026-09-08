import { describe, expect, test } from "bun:test";
import { buildNotificationItems } from "../viewModels/notifications";

describe("notification detail links", () => {
  for (const [relatedType, relatedId, path] of [
    ["challenge", "old-challenge", ""],
    ["activity", "old-activity", ""],
    ["match", "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "/pages/matches/detail?id=f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003"],
    ["team", "42", "/pages/teams/detail/index?id=42"],
    ["captain_message", "thread-1", "/pages/messages/thread/index?id=thread-1"],
  ]) {
    test(`routes ${relatedType} only when a current detail page exists`, () => {
      const [item] = buildNotificationItems([{
        id: 1,
        user_id: 7,
        kind: "system",
        title: "通知",
        content: "详情",
        related_type: relatedType,
        related_id: relatedId,
        read_at: null,
        created_at: "2026-09-08T00:00:00Z",
      }]);
      expect(item.relatedPath).toEqual(path);
    });
  }
});
