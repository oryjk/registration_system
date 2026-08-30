import type { ToasterProps } from "sonner";
import { Toaster as Sonner } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      closeButton
      duration={5000}
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          toast: "admin-sonner-toast",
          title: "admin-sonner-title",
          description: "admin-sonner-description",
          actionButton: "admin-sonner-action",
          cancelButton: "admin-sonner-cancel",
          closeButton: "admin-sonner-close",
        },
      }}
      {...props}
    />
  );
}
