import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * 图片大图预览弹层：小图（头像等）点击后居中放大查看。
 * 支持关闭按钮、Esc / 点击遮罩关闭；遮罩色走全局 dialog overlay token。
 */
export function ImageLightbox({
  src,
  caption,
  open,
  onOpenChange,
}: {
  src?: string | null;
  caption: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="image-lightbox-content"
      >
        {src ? (
          <img alt={caption} className="image-lightbox-img" src={src} />
        ) : null}
        <DialogTitle className="image-lightbox-caption">{caption}</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}
