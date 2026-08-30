import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div aria-live="polite" className="alert" role="alert">
      <TriangleAlert size={16} />
      <div className="alert-body">
        <strong>{message}</strong>
      </div>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          重试
        </Button>
      ) : null}
    </div>
  );
}
