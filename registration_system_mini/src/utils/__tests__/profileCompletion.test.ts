import { describe, expect, test } from "bun:test";
import { needsProfileCompletion } from "../profileCompletion";

describe("needsProfileCompletion", () => {
  test("does not require completion when there is no logged-in user", () => {
    expect(needsProfileCompletion(null)).toEqual(false);
  });

  test("requires completion when nickname is blank", () => {
    expect(
      needsProfileCompletion({
        id: 9022,
        open_id: "openid-9022",
        username: "",
        nickname: "",
        real_name: "",
        avatar_url: "https://example.com/avatar.png",
        phone_number: "",
        is_manager: false,
      }),
    ).toEqual(true);
  });

  test("requires completion when avatar is blank", () => {
    expect(
      needsProfileCompletion({
        id: 9022,
        open_id: "openid-9022",
        username: "",
        nickname: "新球员",
        real_name: "",
        avatar_url: "",
        phone_number: "",
        is_manager: false,
      }),
    ).toEqual(true);
  });

  test("passes when nickname and avatar are both present", () => {
    expect(
      needsProfileCompletion({
        id: 7,
        open_id: "openid-7",
        username: "captain-7",
        nickname: "银河队长",
        real_name: "王睿",
        avatar_url: "https://example.com/avatar.png",
        phone_number: "",
        is_manager: false,
      }),
    ).toEqual(false);
  });
});
