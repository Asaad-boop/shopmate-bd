import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, X, ChevronDown, Printer, FileText, UserCheck, Truck, RefreshCw, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrderListFilterState {
  search: string;
  dateRange: string;
  courier: string;
  staff: string;
  risk: string;
}

export const defaultFilters: OrderListFilterState = {
  search: "",
  dateRange: "last_7",
  courier: "all",
  staff: "all",
  risk: "all",
};

interface Props {
  filters: OrderListFilterState;
  onChange: (f: OrderListFilterState) => void;
  selectedCount: number;
  onBulkAction: (action: string) => void;
}

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7", label: "Last 7 Days" },
  { value: "last_30", label: "Last 30 Days" },
  { value: "custom", label: "Custom" },
];

const COURIERS = [
  { value: "all", label: "All Couriers" },
  { value: "pathao", label: "Pathao" },
  { value: "steadfast", label: "Steadfast" },
  { value: "redx", label: "RedX" },
  { value: "paperfly", label: "Paperfly" },
  { value: "others", label: "Others" },
];

const STAFF = [
  { value: "all", label: "All Staff" },
  { value: "rahim", label: "Rahim" },
  { value: "kamal", label: "Kamal" },
  { value: "sadia", label: "Sadia" },
  { value: "nusrat", label: "Nusrat" },
];

const RISK = [
  { value: "all", label: "All Risk" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function OrderListFilters({ filters, onChange, selectedCount, onBulkAction }: Props) {
  const update = (partial: Partial<OrderListFilterState>) => onChange({ ...filters, ...partial });

  const activeCount = [
    filters.courier !== "all",
    filters.staff !== "all",
    filters.risk !== "all",
    filters.dateRange !== "last_7",
  ].filter(Boolean).length;

  return (
    <div className="sticky top-[97px] z-10 bg-card border-b border-border">
      <div className="flex items-center gap-2 px-6 py-2.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search invoice / phone / name / city / tracking…"
            className="pl-9 h-8 text-xs bg-background"
            value={filters.search}
            onChange={e => update({ search: e.target.value })}
          />
          {filters.search && (
            <button
              onClick={() => update({ search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Range */}
        <Select value={filters.dateRange} onValueChange={v => update({ dateRange: v })}>
          <SelectTrigger className="h-8 w-[130px] text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_OPTIONS.map(d => (
              <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Courier */}
        <Select value={filters.courier} onValueChange={v => update({ courier: v })}>
          <SelectTrigger className="h-8 w-[120px] text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COURIERS.map(c => (
              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Staff */}
        <Select value={filters.staff} onValueChange={v => update({ staff: v })}>
          <SelectTrigger className="h-8 w-[110px] text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAFF.map(s => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Risk */}
        <Select value={filters.risk} onValueChange={v => update({ risk: v })}>
          <SelectTrigger className="h-8 w-[100px] text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RISK.map(r => (
              <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear */}
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => onChange(defaultFilters)}
          >
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}

        <div className="flex-1" />

        {/* Bulk Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 text-xs gap-1", selectedCount === 0 && "opacity-50")}
              disabled={selectedCount === 0}
            >
              Actions
              {selectedCount > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                  {selectedCount}
                </span>
              )}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onBulkAction("status")}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Bulk Update Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkAction("staff")}>
              <UserCheck className="w-3.5 h-3.5 mr-2" /> Assign Staff
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkAction("courier")}>
              <Truck className="w-3.5 h-3.5 mr-2" /> Set Courier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onBulkAction("print_invoice")}>
              <Printer className="w-3.5 h-3.5 mr-2" /> Print Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkAction("print_label")}>
              <FileText className="w-3.5 h-3.5 mr-2" /> Print Label
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onBulkAction("export")}>
              <Download className="w-3.5 h-3.5 mr-2" /> Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
