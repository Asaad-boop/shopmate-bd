import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message = "Something went wrong", onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{message}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-[320px] mb-4">
        Please try again or contact support if the problem persists.
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
