import { type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ConfirmPopoverProps {
  title: string;
  description?: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  children: ReactElement;
}

/** Popconfirm 的等价物：点触发器弹出气泡确认，替代 antd 的命令式确认交互。 */
export function ConfirmPopover({
  title,
  description,
  confirmText,
  cancelText = "返回",
  destructive = false,
  onConfirm,
  children,
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="confirm-popover">
        <div className="confirm-popover-body">
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
        <div className="confirm-popover-actions">
          <Button
            onClick={() => setOpen(false)}
            size="sm"
            type="button"
            variant="outline"
          >
            {cancelText}
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
            size="sm"
            type="button"
            variant={destructive ? "destructive" : "default"}
          >
            {confirmText}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
