import { expect, test } from "bun:test";
import { useOnboardingIllustrations } from "../useOnboardingIllustrations";
import { defaultMiniAppRuntimeConfig, type MiniAppRuntimeConfig } from "@/config/runtimeConfig";

function config(url: string): MiniAppRuntimeConfig {
  return { ...defaultMiniAppRuntimeConfig, home: {
    ...defaultMiniAppRuntimeConfig.home,
    onboarding_welcome_image_url: url,
    onboarding_team_image_url: "team.png",
    onboarding_match_image_url: "match.png",
  } };
}

test("a late image-config request cannot overwrite a newer selection or clear", async () => {
  const requests: ((value: MiniAppRuntimeConfig) => void)[] = [];
  const { illustrations, refreshIllustrations } = useOnboardingIllustrations(
    () => new Promise(resolve => { requests.push(resolve); }),
  );
  const old = refreshIllustrations();
  const latest = refreshIllustrations();
  requests[1]!(config(""));
  await latest;
  requests[0]!(config("old.png"));
  await old;
  expect(illustrations.value).toEqual({ welcome: "", team: "team.png", match: "match.png" });
});

test("artwork load failure is silent and a later refresh can replace the images", async () => {
  let fail = true;
  const { illustrations, refreshIllustrations } = useOnboardingIllustrations(async () => {
    if (fail) throw new Error("offline");
    return config("new.png");
  });
  await refreshIllustrations();
  expect(illustrations.value.welcome).toEqual("");
  fail = false;
  await refreshIllustrations();
  expect(illustrations.value.welcome).toEqual("new.png");
  fail = true;
  await refreshIllustrations();
  expect(illustrations.value.welcome).toEqual("new.png");
});


test("successful refresh advances image retry revision even when the URL is unchanged", async () => {
  const { illustrationRevision, refreshIllustrations } = useOnboardingIllustrations(async () => config("same.png"));
  await refreshIllustrations();
  expect(illustrationRevision.value).toEqual(1);
  await refreshIllustrations();
  expect(illustrationRevision.value).toEqual(2);
});
