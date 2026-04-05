import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PathaoCity {
  city_id: number;
  city_name: string;
}

interface PathaoZone {
  zone_id: number;
  zone_name: string;
}

interface PathaoArea {
  area_id: number;
  area_name: string;
}

interface Props {
  pathaoCityId: number | null;
  pathaoZoneId: number | null;
  pathaoAreaId: number | null;
  onCityChange: (v: string) => void;
  onZoneChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  filteredCities: PathaoCity[];
  filteredZones: PathaoZone[];
  pathaoAreas: PathaoArea[];
  citySearch: string;
  zoneSearch: string;
  onCitySearch: (v: string) => void;
  onZoneSearch: (v: string) => void;
  citiesLoading: boolean;
  zonesLoading: boolean;
  isReparsing: boolean;
  onReparse: () => void;
  confidence: number | null;
}

export function WebOrderLocationStrip({
  pathaoCityId, pathaoZoneId, pathaoAreaId,
  onCityChange, onZoneChange, onAreaChange,
  filteredCities, filteredZones, pathaoAreas,
  citySearch, zoneSearch, onCitySearch, onZoneSearch,
  citiesLoading, zonesLoading, isReparsing, onReparse,
  confidence,
}: Props) {
  const isMapped = !!(pathaoCityId && pathaoZoneId);

  return (
    <div className={cn(
      "rounded-lg border-2 p-3 transition-all duration-200",
      isMapped
        ? "border-success/40 bg-success/5 shadow-[0_0_12px_hsl(var(--success)/0.08)]"
        : "border-warning/40 bg-warning/5"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            📍 Pathao Location Mapping
          </Label>
          {isMapped && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">✓ Mapped</span>
          )}
          {confidence !== null && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded font-medium",
              confidence >= 85 ? "bg-success/15 text-success" :
              confidence >= 70 ? "bg-warning/15 text-warning" :
              "bg-destructive/15 text-destructive"
            )}>
              {confidence}% conf
            </span>
          )}
        </div>
        <Button
          variant="ghost" size="sm"
          onClick={onReparse}
          disabled={isReparsing}
          className="h-6 px-2 text-[9px] gap-1 text-muted-foreground hover:text-foreground"
        >
          {isReparsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Re-parse
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* City */}
        <div>
          <Label className="text-[9px] text-muted-foreground">City *</Label>
          <Select value={pathaoCityId ? String(pathaoCityId) : ""} onValueChange={onCityChange}>
            <SelectTrigger className={cn("h-8 text-xs", pathaoCityId && "border-success/50")}>
              <SelectValue placeholder={citiesLoading ? "Loading..." : "Select City"} />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50 max-h-60">
              <div className="px-2 py-1.5 sticky top-0 bg-popover border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    className="w-full pl-6 pr-2 py-1 text-[11px] rounded border border-input bg-background outline-none text-foreground"
                    placeholder="Search city..."
                    value={citySearch}
                    onChange={(e) => onCitySearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              {filteredCities.map((c) => (
                <SelectItem key={c.city_id} value={String(c.city_id)} className="text-xs">{c.city_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Zone */}
        <div>
          <Label className="text-[9px] text-muted-foreground">Zone *</Label>
          <Select value={pathaoZoneId ? String(pathaoZoneId) : ""} onValueChange={onZoneChange} disabled={!pathaoCityId}>
            <SelectTrigger className={cn("h-8 text-xs", pathaoZoneId && "border-success/50")}>
              <SelectValue placeholder={zonesLoading ? "Loading..." : "Select Zone"} />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50 max-h-60">
              <div className="px-2 py-1.5 sticky top-0 bg-popover border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    className="w-full pl-6 pr-2 py-1 text-[11px] rounded border border-input bg-background outline-none text-foreground"
                    placeholder="Search zone..."
                    value={zoneSearch}
                    onChange={(e) => onZoneSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              {filteredZones.map((z) => (
                <SelectItem key={z.zone_id} value={String(z.zone_id)} className="text-xs">{z.zone_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Area */}
        <div>
          <Label className="text-[9px] text-muted-foreground">Area</Label>
          <Select value={pathaoAreaId ? String(pathaoAreaId) : ""} onValueChange={onAreaChange} disabled={!pathaoZoneId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select an area" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50 max-h-60">
              {pathaoAreas?.map((a) => (
                <SelectItem key={a.area_id} value={String(a.area_id)} className="text-xs">{a.area_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
