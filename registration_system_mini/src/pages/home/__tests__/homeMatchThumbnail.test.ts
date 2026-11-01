import { describe, expect, test } from "bun:test";
import { HOME_MATCH_THUMBNAIL_POOL } from "@/config/homeVisualAssets";
import { DEFAULT_MATCH_COVER_URL } from "@/config/matchCover";
import { resolveHomeMatchThumbnail } from "../homeMatchThumbnail";

describe("home match thumbnails", () => {
  test("uses the creator's cover before any default picture", () => {
    expect(resolveHomeMatchThumbnail({ id: "match-a", coverImageUrl: "  https://example.com/custom.webp  " }))
      .toEqual("https://example.com/custom.webp");
  });

  test("old records, empty strings and whitespace all receive a pool picture", () => {
    for (const coverImageUrl of [undefined, "", "  "]) {
      expect(HOME_MATCH_THUMBNAIL_POOL.includes(resolveHomeMatchThumbnail({ id: "match-a", coverImageUrl })))
        .toEqual(true);
    }
  });

  test("keeps each match's picture stable across refreshes and list ordering", () => {
    const ids = ["match-a", "match-b", "match-c"];
    const before = Object.fromEntries(ids.map(id => [id, resolveHomeMatchThumbnail({ id })]));
    for (const id of [...ids].reverse()) {
      expect(resolveHomeMatchThumbnail({ id })).toEqual(before[id]);
    }
  });

  test("distributes ordinary match IDs over all ten pictures", () => {
    const selected = new Set(Array.from({ length: 300 }, (_, i) => resolveHomeMatchThumbnail({ id: `match-${i}` })));
    expect(selected.size).toEqual(10);
    expect([...selected].every(url => HOME_MATCH_THUMBNAIL_POOL.includes(url))).toEqual(true);
  });

  test("a failed custom cover falls back to the same match's pool picture", () => {
    const match = { id: "match-a", coverImageUrl: "https://example.com/broken.webp" };
    const fallback = resolveHomeMatchThumbnail(match, [match.coverImageUrl]);
    expect(HOME_MATCH_THUMBNAIL_POOL.includes(fallback)).toEqual(true);
    expect(fallback).toEqual(resolveHomeMatchThumbnail({ id: match.id }));
  });

  test("image failures terminate in an icon instead of a retry loop", () => {
    const match = { id: "match-a", coverImageUrl: "https://example.com/broken.webp" };
    const failed = [match.coverImageUrl];
    const poolPicture = resolveHomeMatchThumbnail(match, failed);
    failed.push(poolPicture);
    expect(resolveHomeMatchThumbnail(match, failed)).toEqual(DEFAULT_MATCH_COVER_URL);
    failed.push(DEFAULT_MATCH_COVER_URL);
    expect(resolveHomeMatchThumbnail(match, failed)).toEqual("");
  });

  test("changing a cover or match does not reuse another image's failure", () => {
    const failed = ["https://example.com/old.webp"];
    expect(resolveHomeMatchThumbnail({ id: "match-b", coverImageUrl: "https://example.com/new.webp" }, failed))
      .toEqual("https://example.com/new.webp");
  });
});
