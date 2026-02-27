import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { OrderListHeader } from "./OrderListHeader";
import { OrderStatusTabs } from "./OrderStatusTabs";
import { OrderListFilters, defaultFilters, type OrderListFilterState } from "./OrderListFilters";
import { OrderListTable } from "./OrderListTable";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { OrderBulkBar } from "./OrderBulkBar";
import { generateMockOrders, type MockOrder, type OrderStatus } from "./order-list-data";
import { toast } from "sonner";

const ALL_ORDERS = generateMockOrders(120);

export function OrderListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all");
  const [filters, setFilters] = useState<OrderListFilterState>(defaultFilters);
  const [density, setDensity] = useState<"comfortable" | "compact">("compact");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailOrder, setDetailOrder] = useState<MockOrder | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [loading] = useState(false);

  const filtered = useMemo(() => {
    let result = ALL_ORDERS;
    if (activeTab !== "all") result = result.filter(o => o.status === activeTab);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(o =>
        o.invoiceId.toLowerCase().includes(s) ||
        o.customerName.toLowerCase().includes(s) ||
        o.customerPhone.includes(s) ||
        o.city.toLowerCase().includes(s) ||
        o.area.toLowerCase().includes(s) ||
        o.trackingId.toLowerCase().includes(s)
      );
    }
    if (filters.courier !== "all") result = result.filter(o => o.courier.toLowerCase() === filters.courier);
    if (filters.risk !== "all") result = result.filter(o => o.risk === filters.risk);
    return result;
  }, [activeTab, filters]);

  const handleRefresh = useCallback(() => { toast.success("Refreshed"); }, []);

  const handleBulkAction = useCallback((action: string) => {
    toast.info(`Bulk action: ${action} on ${selectedIds.size} orders`);
    setSelectedIds(new Set());
  }, [selectedIds.size]);

  const handleSelectAll = useCallback(() => {
    const all = new Set(filtered.map(o => o.id));
    setSelectedIds(all);
    toast.info(`Selected all ${all.size} orders`);
  }, [filtered]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      <OrderListHeader
        density={density}
        onDensityChange={setDensity}
        onRefresh={handleRefresh}
        onNewOrder={() => navigate("/orders/new")}
      />

      <OrderStatusTabs
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setSelectedIds(new Set()); }}
        orders={ALL_ORDERS}
      />

      <OrderListFilters
        filters={filters}
        onChange={setFilters}
        selectedCount={selectedIds.size}
        totalCount={filtered.length}
        onBulkAction={handleBulkAction}
        onSelectAll={handleSelectAll}
      />

      <OrderListTable
        orders={filtered}
        loading={loading}
        density={density}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenDetail={setDetailOrder}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      <OrderDetailSheet
        order={detailOrder}
        open={!!detailOrder}
        onOpenChange={(open) => !open && setDetailOrder(null)}
      />

      <OrderBulkBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onAction={handleBulkAction}
      />
    </div>
  );
}
