import { computed, ref } from "vue";
import { getMiniReviewStatus } from "@/api/miniReview";
import { MINI_PROGRAM_VERSION } from "@/config/generatedMiniProgramVersion";
import type { BackendMiniReviewStatus } from "@/types/backend";

const forceMiniReviewMode = String(import.meta.env.VITE_FORCE_MINI_REVIEW_MODE || "").trim().toLowerCase() === "true";
const reviewStatus = ref<BackendMiniReviewStatus | null>(null);
const reviewMode = ref(false);
const reviewStatusLoading = ref(false);
const shouldCheckMiniReview = import.meta.env.PROD;
const reviewStatusReady = ref(forceMiniReviewMode || !shouldCheckMiniReview);
const reviewStatusAvailable = ref(forceMiniReviewMode);
const shouldHideCreationEntrances = computed(
  () => forceMiniReviewMode || (shouldCheckMiniReview && (!reviewStatusReady.value || !reviewStatusAvailable.value || reviewMode.value)),
);

let reviewStatusPromise: Promise<BackendMiniReviewStatus | null> | null = null;

export async function preloadMiniReviewStatus(force = false) {
  if (forceMiniReviewMode) {
    reviewStatus.value = {
      project_code: "registration_system_mini",
      version: MINI_PROGRAM_VERSION,
      is_reviewing: true,
      status_text: "开发环境强制审核态",
    };
    reviewMode.value = true;
    reviewStatusLoading.value = false;
    reviewStatusReady.value = true;
    reviewStatusAvailable.value = true;
    console.info(`[mini-review] forced in dev: version=${MINI_PROGRAM_VERSION}, reviewing=true`);
    return reviewStatus.value;
  }

  if (!shouldCheckMiniReview) {
    reviewStatus.value = null;
    reviewMode.value = false;
    reviewStatusLoading.value = false;
    reviewStatusReady.value = true;
    reviewStatusAvailable.value = false;
    console.info("[mini-review] skipped: non-production env");
    return null;
  }

  if (reviewStatusPromise && !force) {
    return reviewStatusPromise;
  }

  reviewStatusPromise = (async () => {
    reviewStatusLoading.value = true;
    try {
      const status = await getMiniReviewStatus("registration_system_mini", MINI_PROGRAM_VERSION);
      reviewStatus.value = status;
      reviewMode.value = status.is_reviewing;
      reviewStatusAvailable.value = true;
      console.info(`[mini-review] loaded: version=${MINI_PROGRAM_VERSION}, reviewing=${status.is_reviewing}`);
      return status;
    } catch (_error) {
      reviewStatus.value = null;
      reviewMode.value = false;
      reviewStatusAvailable.value = false;
      console.warn(`[mini-review] failed: version=${MINI_PROGRAM_VERSION}`);
      return null;
    } finally {
      reviewStatusLoading.value = false;
      reviewStatusReady.value = true;
      reviewStatusPromise = null;
    }
  })();

  return reviewStatusPromise;
}

export function useMiniReviewStatus() {
  return {
    forceMiniReviewMode,
    shouldCheckMiniReview,
    reviewStatusReady,
    reviewStatusAvailable,
    reviewStatus,
    reviewMode,
    reviewStatusLoading,
    shouldHideCreationEntrances,
    preloadMiniReviewStatus,
  };
}
