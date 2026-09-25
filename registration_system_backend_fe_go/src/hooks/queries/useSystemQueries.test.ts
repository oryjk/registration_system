import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { invalidateMiniAppSettings } from "./useSystemQueries";

describe("invalidateMiniAppSettings", () => {
  it("invalidates the cached mini app settings so uploads refresh the preview", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.miniAppSettings, {
      debug: {
        clear_profile_enabled: false,
        review_status_toggle_enabled: false,
      },
      onboarding: { enabled: false },
      home: { next_match_social_image_url: "https://cdn.example.com/old.png" },
    });

    const stateBefore = queryClient.getQueryState(queryKeys.miniAppSettings);
    expect(stateBefore?.isInvalidated).toEqual(false);

    await invalidateMiniAppSettings(queryClient);

    expect(
      queryClient.getQueryState(queryKeys.miniAppSettings)?.isInvalidated,
    ).toEqual(true);
  });
});
