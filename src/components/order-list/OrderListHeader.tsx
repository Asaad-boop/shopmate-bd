import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Plus, Sun, Moon, AlignJustify, AlignCenter } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface Props {
  density: "comfortable" | "compact";
  onDensityChange: (d: "comfortable" | "compact") => void;
  onRefresh: () => void;
  onNewOrder: () => void;
  selectedCount: number;
}

export function OrderListHeader({ density, onDensityChange, onRefresh, onNewOrder, selectedCount }: Props) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="sticky top-0 z-30 bg-card border-b border-border shadow-[0_1px_3px_0_hsl(var(--border)/0.3)]">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Order List</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage COD orders quickly with bulk actions</p>
          </div>
          {/* Selection indicator */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 overflow-hidden",
              selectedCount > 0
                ? "opacity-100 max-w-[200px] border-primary/30 bg-primary/5"
                : "opacity-0 max-w-0 border-transparent px-0"
            )}
          >
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-bold">
              {selectedCount}
            </span>
            <span className="text-xs font-semibold text-primary whitespace-nowrap">
              Orders Selected
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTheme(isDark ? "light" : "dark")}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDensityChange(density === "comfortable" ? "compact" : "comfortable")}
              >
                {density === "compact" ? <AlignCenter className="w-4 h-4" /> : <AlignJustify className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{density === "compact" ? "Comfortable" : "Compact"}</TooltipContent>
          </Tooltip>

          <Button size="sm" className="h-8 text-xs gap-1.5 ml-2" onClick={onNewOrder}>
            <Plus className="w-3.5 h-3.5" /> New Order
          </Button>
        </div>
      </div>
    </div>
  );
}
