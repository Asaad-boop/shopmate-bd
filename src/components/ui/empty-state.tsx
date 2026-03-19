import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon, Plus } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground text-center max-w-[320px] mb-4">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
