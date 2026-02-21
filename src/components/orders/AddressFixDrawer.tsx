import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MapPin, CheckCircle2, AlertTriangle, Loader2, Search, Truck } from "lucide-react";
import { usePathaoCities, usePathaoZones } from "@/hooks/use-pathao";
import type { MappingResult } from "@/lib/address-mapper";

interface AddressFixDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  fullAddress: string;
  mappingResult: MappingResult | null;
  onAccept: (cityId: number, cityName: string, zoneId: number, zoneName: string) => void;
  loading?: boolean;
}

export function AddressFixDrawer({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  fullAddress,
  mappingResult,
  onAccept,
  loading,
}: AddressFixDrawerProps) {
  const [cityId, setCityId] = useState<number | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [citySearch, setCitySearch] = useState("");
  const [zoneSearch, setZoneSearch] = useState("");

  const { data: cities, isLoading: citiesLoading } = usePathaoCities();
  const { data: zones, isLoading: zonesLoading } = usePathaoZones(cityId);

  // Pre-fill from mapping suggestions
  useEffect(() => {
    if (open && mappingResult) {
      if (mappingResult.cityId) setCityId(mappingResult.cityId);
      if (mappingResult.zoneId) setZoneId(mappingResult.zoneId);
    }
  }, [open, mappingResult]);

  useEffect(() => { setZoneId(null); }, [cityId]);

  const filteredCities = cities?.filter((c) =>
    c.city_name.toLowerCase().includes(citySearch.toLowerCase())
  ) || [];

  const filteredZones = zones?.filter((z) =>
    z.zone_name.toLowerCase().includes(zoneSearch.toLowerCase())
  ) || [];

  const scoreColor = (score: number) => {
    if (score >= 0.85) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (score >= 0.65) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const scorePercent = (score: number) => `${Math.round(score * 100)}%`;

  const selectedCityName = cities?.find((c) => c.city_id === cityId)?.city_name || "";
  const selectedZoneName = zones?.find((z) => z.zone_id === zoneId)?.zone_name || "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-white/95 backdrop-blur-xl border-slate-200/60 text-slate-900 w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-slate-900">
            <MapPin className="w-4 h-4 text-orange-500" />
            Fix Address Mapping
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Order info */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <p className="text-[11px] text-slate-500 font-medium">Order #{orderNumber}</p>
            <p className="text-sm text-slate-700 mt-1 line-clamp-3">{fullAddress || "No address"}</p>
          </div>

          {/* AI Suggestions with confidence */}
          {mappingResult && (
            <>
              <div>
                <p className="text-[11px] text-slate-500 font-medium mb-2">AI Detected</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-16">District:</span>
                    {mappingResult.cityName ? (
                      <Badge variant="outline" className={cn("text-[10px] gap-1", scoreColor(mappingResult.cityScore))}>
                        {mappingResult.cityName}
                        <span className="font-mono">({scorePercent(mappingResult.cityScore)})</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 gap-1">
                        <AlertTriangle className="w-3 h-3" /> Not detected
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-16">Thana:</span>
                    {mappingResult.zoneName ? (
                      <Badge variant="outline" className={cn("text-[10px] gap-1", scoreColor(mappingResult.zoneScore))}>
                        {mappingResult.zoneName}
                        <span className="font-mono">({scorePercent(mappingResult.zoneScore)})</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 gap-1">
                        <AlertTriangle className="w-3 h-3" /> Not detected
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Separator className="bg-slate-200/60" />
            </>
          )}

          {/* Quick Accept if suggestions exist */}
          {mappingResult?.cityId && mappingResult?.zoneId && (
            <Button
              onClick={() => onAccept(mappingResult.cityId!, mappingResult.cityName, mappingResult.zoneId!, mappingResult.zoneName)}
              disabled={loading}
              className="w-full rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Accept & Send to Pathao
            </Button>
          )}

          {/* Manual selection */}
          <div>
            <p className="text-[11px] text-slate-500 font-medium mb-3">Manual Selection</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 font-medium mb-1 block">City (District) *</label>
                <Select value={cityId ? String(cityId) : ""} onValueChange={(v) => setCityId(Number(v))}>
                  <SelectTrigger className="rounded-xl h-9 text-sm bg-white/80 border-slate-200/60">
                    <SelectValue placeholder={citiesLoading ? "Loading..." : "Select City"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 max-h-60">
                    <div className="px-2 py-1.5 sticky top-0 bg-white">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-input bg-background outline-none"
                          placeholder="Search city..."
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {filteredCities.map((c) => (
                      <SelectItem key={c.city_id} value={String(c.city_id)}>{c.city_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium mb-1 block">Zone (Thana) *</label>
                <Select value={zoneId ? String(zoneId) : ""} onValueChange={(v) => setZoneId(Number(v))} disabled={!cityId}>
                  <SelectTrigger className="rounded-xl h-9 text-sm bg-white/80 border-slate-200/60">
                    <SelectValue placeholder={zonesLoading ? "Loading..." : "Select Zone"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 max-h-60">
                    <div className="px-2 py-1.5 sticky top-0 bg-white">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-input bg-background outline-none"
                          placeholder="Search zone..."
                          value={zoneSearch}
                          onChange={(e) => setZoneSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {filteredZones.map((z) => (
                      <SelectItem key={z.zone_id} value={String(z.zone_id)}>{z.zone_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Send button for manual selection */}
          {cityId && zoneId && !(mappingResult?.cityId === cityId && mappingResult?.zoneId === zoneId) && (
            <Button
              onClick={() => onAccept(cityId, selectedCityName, zoneId, selectedZoneName)}
              disabled={loading}
              className="w-full rounded-xl h-10 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Send to Pathao
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
