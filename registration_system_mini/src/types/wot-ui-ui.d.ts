export type DialogResult = {
  action: "confirm" | "cancel" | "modal" | "close";
  value?: string | number;
};

export type DialogOptions = {
  title?: string;
  msg?: string;
  showCancelButton?: boolean;
  cancelButtonText?: string;
  confirmButtonText?: string;
  showClose?: boolean;
  actionLayout?: "horizontal" | "vertical";
    confirmButtonProps?: {
      type?: "primary" | "success" | "info" | "warning" | "danger";
      customClass?: string;
      [key: string]: unknown;
    };
    cancelButtonProps?: {
      type?: "primary" | "success" | "info" | "warning" | "danger";
      customClass?: string;
      [key: string]: unknown;
    };
  };

export function useDialog(selector?: string): {
  confirm(options: DialogOptions | string): Promise<DialogResult>;
  close(): void;
};
