import { Children, cloneElement, isValidElement, memo } from "react";
import { cn } from "@/lib/utils";

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerMs?: number;
}

/** Wraps children with staggered fade-in-up animation via CSS custom property */
export const StaggerContainer = memo(function StaggerContainer({
  children,
  className,
  staggerMs = 40,
}: StaggerContainerProps) {
  return (
    <div className={cn("contents", className)}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        return (
          <div
            className="animate-stagger-in"
            style={{ animationDelay: `${i * staggerMs}ms` }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
});
