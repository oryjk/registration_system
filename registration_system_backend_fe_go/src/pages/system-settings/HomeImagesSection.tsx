import {
  useOnboardingImageMutations,
  useUploadNextMatchSocialImageMutation,
} from "@/hooks/queries/useSystemQueries";
import type { MiniAppHomeSettings, OnboardingImageScene } from "@/types/system";
import { ImageSetting } from "./ImageSetting";

export function HomeNextMatchSocialImageSection({
  savedImageUrl,
}: {
  savedImageUrl: string;
}) {
  const uploadImage = useUploadNextMatchSocialImageMutation();
  return (
    <ImageSetting
      title="首页空状态插画"
      description="用于首页球队管理者没有下一场比赛时的社交约球插画。建议透明背景插画，按原始比例显示，不限定比例。PNG / JPG / WebP，不超过 2MB；刷新运行配置后生效，无需重新发布小程序。"
      savedImageUrl={savedImageUrl}
      uploadImage={uploadImage}
    />
  );
}

const scenes: { scene: OnboardingImageScene; title: string }[] = [
  { scene: "welcome", title: "首次进入引导图" },
  { scene: "team", title: "组队 / 入队引导图" },
  { scene: "match", title: "找比赛引导图" },
];

export function OnboardingImagesSection({
  home,
  disabled,
}: {
  home?: MiniAppHomeSettings;
  disabled: boolean;
}) {
  return (
    <section className="settings-stack" aria-label="新版引导图片">
      <div>
        <strong>新版引导图片</strong>
        <p className="setting-row-description">
          三个场景独立保存。建议 1:1、1024×1024px，透明背景、无文字 PNG；支持
          PNG / JPG / WebP，每张不超过
          2MB。上传或清空后自动保存，小程序刷新运行配置后生效，无需重新上传小程序。
        </p>
      </div>
      {scenes.map(({ scene, title }) => (
        <OnboardingImageSetting
          key={scene}
          scene={scene}
          title={title}
          savedImageUrl={home?.[`onboarding_${scene}_image_url`] ?? ""}
          disabled={disabled}
        />
      ))}
    </section>
  );
}

function OnboardingImageSetting({
  scene,
  title,
  savedImageUrl,
  disabled,
}: {
  scene: OnboardingImageScene;
  title: string;
  savedImageUrl: string;
  disabled: boolean;
}) {
  const { upload, clear } = useOnboardingImageMutations(scene);
  return (
    <ImageSetting
      title={title}
      description="未配置或图片加载失败时，使用小程序内置视觉。"
      savedImageUrl={savedImageUrl}
      uploadImage={upload}
      clearImage={clear}
      disabled={disabled}
    />
  );
}
