import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { ParseAddressResult, ZoneSuggestion } from "@/lib/pathao-address-parser";
import { getParseConfidenceLevel } from "@/lib/pathao-address-parser";

interface AddressMapperPanelProps {
  parseResult: ParseAddressResult | null;
  mappingMode: "auto" | "manual";
  onApplySuggestion: (suggestion: ZoneSuggestion) => void;
  onReAutoMap: () => void;
}

export function AddressMapperPanel({
  parseResult,
  mappingMode,
  onApplySuggestion,
  onReAutoMap,
}: AddressMapperPanelProps) {
  const [reasonsExpanded, setReasonsExpanded] = useState(false);

  if (!parseResult) return null;

  const conf = getParseConfidenceLevel(parseResult.confidence);
  const pct = Math.round(parseResult.confidence * 100);

  const StatusIcon = conf.level === "high" ? CheckCircle2 : conf.level === "medium" ? AlertTriangle : XCircle;

  return (
    <div className={cn(
      "rounded-lg border p-2.5 space-y-2 transition-all",
      conf.level === "high" && "bg-emerald-50/40 border-emerald-200/60",
      conf.level === "medium" && "bg-amber-50/40 border-amber-200/60",
      conf.level === "low" && "bg-red-50/40 border-red-200/60",
    )}>
      {/* Badge row */}
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className={cn("text-[10px] gap-1 px-2 py-0.5", conf.color)}>
          <StatusIcon className="w-3 h-3" />
          {conf.icon} {pct}% — {conf.label}
        </Badge>
        <div className="flex items-center gap-1.5">
          {parseResult.zone && (
            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0">
              📖 {parseResult.zone}
            </Badge>
          )}
          {parseResult.area && (
            <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-700 border-violet-200 px-1.5 py-0">
              📍 {parseResult.area}
            </Badge>
          )}
        </div>
      </div>

      {/* Manual mode indicator + Re-auto-map */}
      {mappingMode === "manual" && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground italic">Manual override active — suggestions only</span>
          <Button variant="ghost" size="sm" onClick={onReAutoMap}
            className="h-5 px-2 text-[9px] gap-1 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)]">
            <RefreshCw className="w-2.5 h-2.5" /> Re-auto-map
          </Button>
        </div>
      )}

      {/* Suggestions */}
      {parseResult.top_suggestions.length > 0 && (conf.level !== "high" || mappingMode === "manual") && (
        <div>
          <p className="text-[9px] font-medium text-muted-foreground mb-1">⚡ Suggestions (click to apply):</p>
          <div className="flex flex-wrap gap-1">
            {parseResult.top_suggestions.slice(0, 3).map((s, idx) => (
              <button
                key={idx}
                onClick={() => onApplySuggestion(s)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-medium border transition-all",
                  "bg-background hover:bg-muted/80 text-foreground border-border hover:border-muted-foreground/40"
                )}
              >
                {s.zone}{s.area ? ` → ${s.area}` : ""} ({s.score}pts)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reasons (expandable) */}
      {parseResult.reasons.length > 0 && (
        <div>
          <button
            onClick={() => setReasonsExpanded(!reasonsExpanded)}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {reasonsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {reasonsExpanded ? "Hide reasons" : `${parseResult.reasons.length} reason(s)…`}
          </button>
          {reasonsExpanded && (
            <ul className="mt-1 space-y-0.5">
              {parseResult.reasons.map((r, i) => (
                <li key={i} className="text-[8px] text-muted-foreground pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-muted-foreground/30">
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
