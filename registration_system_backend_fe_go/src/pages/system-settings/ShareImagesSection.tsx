import { useShareImageMutations } from "@/hooks/queries/useSystemQueries";
import type { MiniAppHomeSettings, ShareImageScene } from "@/types/system";
import { ImageSetting } from "./ImageSetting";

const scenes: { scene: ShareImageScene; title: string }[] = [
  { scene: "home", title: "首页分享" },
  { scene: "hall", title: "约队大厅" },
  { scene: "team", title: "球队邀请" },
  { scene: "match", title: "比赛详情" },
];

export function ShareImagesSection({
  home,
  disabled,
}: {
  home?: MiniAppHomeSettings;
  disabled: boolean;
}) {
  return (
    <section className="settings-stack" aria-label="分享封面">
      <div>
        <strong>分享封面</strong>
        <p className="setting-row-description">
          建议比例 5:4，尺寸 1000×800px；支持 PNG / JPG / WebP，每张不超过 2MB。
          四个场景独立保存，上传或清空后自动保存。小程序刷新运行配置后生效；清空后恢复内置新版分享封面。
        </p>
      </div>
      {scenes.map(({ scene, title }) => (
        <ShareImageSetting
          key={scene}
          scene={scene}
          title={title}
          savedImageUrl={home?.[`share_${scene}_image_url`] ?? ""}
          disabled={disabled}
        />
      ))}
    </section>
  );
}

function ShareImageSetting({
  scene,
  title,
  savedImageUrl,
  disabled,
}: {
  scene: ShareImageScene;
  title: string;
  savedImageUrl: string;
  disabled: boolean;
}) {
  const { upload, clear } = useShareImageMutations(scene);
  return (
    <ImageSetting
      title={title}
      description={
        scene === "team"
          ? "请为左下方队徽留白：以 1000×800px 画布为例，队徽圆心距左侧 320px、顶部 640px，半径 95px；重要文字和人物请避开此区域。"
          : "未配置时使用内置新版分享封面。建议 5:4、1000×800px。"
      }
      savedImageUrl={savedImageUrl}
      uploadImage={upload}
      clearImage={clear}
      disabled={disabled}
      recommendedRatio={5 / 4}
    />
  );
}
