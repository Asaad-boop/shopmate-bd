import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Search, Filter, CalendarIcon, X, Download, RefreshCw, Plus, FileSpreadsheet, FileText,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface OrderFilters {
  search: string;
  source: string;
  courier: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
}

export const defaultOrderFilters: OrderFilters = {
  search: "",
  source: "all",
  courier: "all",
  dateFrom: undefined,
  dateTo: undefined,
  amountMin: "",
  amountMax: "",
};

interface OrdersFilterBarProps {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  onRefresh: () => void;
  onExport: (type: "csv" | "excel") => void;
  onNewOrder: () => void;
  totalOrders: number;
}

const SOURCES = [
  { value: "all", label: "All Sources" },
  { value: "facebook", label: "📘 Facebook" },
  { value: "whatsapp", label: "💬 WhatsApp" },
  { value: "shopify", label: "🛍️ Shopify" },
  { value: "instagram", label: "📸 Instagram" },
  { value: "phone", label: "📞 Phone" },
  { value: "manual", label: "✍️ Manual" },
];

const COURIERS = [
  { value: "all", label: "All Couriers" },
  { value: "pathao", label: "Pathao" },
  { value: "steadfast", label: "Steadfast" },
  { value: "redx", label: "RedX" },
  { value: "paperfly", label: "Paperfly" },
];

export function OrdersFilterBar({ filters, onFiltersChange, onRefresh, onExport, onNewOrder, totalOrders }: OrdersFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (partial: Partial<OrderFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const activeFilterCount = [
    filters.source !== "all",
    filters.courier !== "all",
    filters.dateFrom != null,
    filters.dateTo != null,
    filters.amountMin !== "",
    filters.amountMax !== "",
  ].filter(Boolean).length;

  return (
    <div className="border-b bg-card">
      {/* Main bar */}
      <div className="flex items-center gap-3 px-6 py-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[280px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice, customer, phone, tracking ID…"
            className="pl-9 h-9 bg-background"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
          {filters.search && (
            <button
              onClick={() => update({ search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium">
              <CalendarIcon className="w-3.5 h-3.5" />
              {filters.dateFrom ? format(filters.dateFrom, "dd MMM") : "Start"} – {filters.dateTo ? format(filters.dateTo, "dd MMM") : "End"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
            <div className="flex gap-2 p-3">
              <div>
                <p className="text-xs font-medium mb-1 text-muted-foreground">From</p>
                <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => update({ dateFrom: d })} />
              </div>
              <div>
                <p className="text-xs font-medium mb-1 text-muted-foreground">To</p>
                <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => update({ dateTo: d })} />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Filters toggle */}
        <Button
          variant={showAdvanced ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5 text-xs font-medium"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => onFiltersChange(defaultOrderFilters)}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        )}

        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover z-50">
              <DropdownMenuItem onClick={() => onExport("csv")}>
                <FileText className="w-4 h-4 mr-2" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("excel")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="h-9 text-xs gap-1.5 shadow-sm" onClick={onNewOrder}>
            <Plus className="w-3.5 h-3.5" /> New Order
          </Button>
        </div>
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="px-6 py-3 border-t bg-muted/20 grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Source</p>
            <Select value={filters.source} onValueChange={(v) => update({ source: v })}>
              <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Courier</p>
            <Select value={filters.courier} onValueChange={(v) => update({ courier: v })}>
              <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {COURIERS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Amount Range</p>
            <div className="flex gap-1.5">
              <Input
                placeholder="Min"
                className="h-8 text-xs bg-background w-20"
                type="number"
                value={filters.amountMin}
                onChange={(e) => update({ amountMin: e.target.value })}
              />
              <span className="text-muted-foreground self-center text-xs">–</span>
              <Input
                placeholder="Max"
                className="h-8 text-xs bg-background w-20"
                type="number"
                value={filters.amountMax}
                onChange={(e) => update({ amountMax: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-end">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{totalOrders}</span> orders
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
