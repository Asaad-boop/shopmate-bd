import { useState, useCallback, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  CommunityFeaturesModule,
  ColDef,
  CellValueChangedEvent,
  GetRowIdParams,
  GridReadyEvent,
  SelectionChangedEvent,
  ICellRendererParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLegacyCourierSync } from "@/hooks/use-legacy-courier-sync";
import { usePostSettlement } from "@/hooks/use-settlement-posting";
import { calculateNetPayable } from "@/lib/courier-calc";
import { formatBDT2, formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, Clock, XCircle, AlertTriangle, Loader2 } from "lucide-react";

ModuleRegistry.registerModules([CommunityFeaturesModule]);

/* ─── Status color maps ─── */
const ERP_STATUSES = ["pending", "packed", "shipped", "in_transit", "delivered", "returned", "exchanged"];
const COURIER_NAMES = ["Pathao", "Steadfast", "RedX", "Sundorban", "eCourier", "PaperFly"];
const ADVANCE_METHODS = ["BKASH", "NAGAD", "BANK", "CASH"];

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "#fef3c7", packed: "#dbeafe", shipped: "#c7d2fe", in_transit: "#e0e7ff",
    delivered: "#d1fae5", returned: "#fee2e2", exchanged: "#ede9fe",
    DELIVERED: "#d1fae5", RETURNED: "#fee2e2", IN_TRANSIT: "#dbeafe",
    PARTIAL_DELIVERED: "#fef3c7", UNKNOWN: "#f3f4f6",
    SYNCED: "#d1fae5", FAILED: "#fee2e2", NOT_SYNCED: "#f3f4f6",
  };
  return map[status] || "#f9fafb";
}

/* ─── Badge cell renderer ─── */
function BadgeCellRenderer(props: ICellRendererParams) {
  const val = props.value || "—";
  return (
    <span
      style={{
        backgroundColor: statusColor(val),
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {val}
    </span>
  );
}

/* ─── Sync badge renderer ─── */
function SyncBadgeRenderer(props: ICellRendererParams) {
  const status = props.value || "NOT_SYNCED";
  const icon = status === "SYNCED" ? "✅" : status === "FAILED" ? "❌" : "⏳";
  return (
    <span
      style={{
        backgroundColor: statusColor(status),
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
      }}
      title={props.data?.courier_last_sync_error || ""}
    >
      {icon} {status === "SYNCED" ? "Synced" : status === "FAILED" ? "Failed" : "Not Synced"}
    </span>
  );
}

/* ─── Settlement button renderer ─── */
function SettlementCellRenderer(props: ICellRendererParams & { onPost: (data: any) => void }) {
  const data = props.data;
  if (data?.settlement_posted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "hsl(160, 84%, 30%)" }}>
        <CheckCircle className="w-3.5 h-3.5" /> Posted
      </span>
    );
  }
  const hasCharges = data?.courier_total_cost > 0 || data?.courier_delivery_fee > 0;
  const isDelivered = data?.courier_final_status === "DELIVERED" || data?.status === "delivered";
  if (isDelivered && hasCharges) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-[11px] px-2 gap-1"
        onClick={(e) => { e.stopPropagation(); props.onPost(data); }}
      >
        Post Settlement
      </Button>
    );
  }
  return <span className="text-xs text-muted-foreground">Pending</span>;
}

/* ─── Sync action renderer ─── */
function SyncActionRenderer(props: ICellRendererParams & { onSync: (data: any) => void; syncing: boolean }) {
  const data = props.data;
  if (!data?.legacy_tracking_id) return <span className="text-xs text-muted-foreground">—</span>;
  if (data?.courier_sync_status === "SYNCED") {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-[11px] px-2 gap-1"
        onClick={(e) => { e.stopPropagation(); props.onSync(data); }}
      >
        <RefreshCw className="w-3 h-3" /> Re-sync
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 text-[11px] px-2 gap-1"
      disabled={props.syncing}
      onClick={(e) => { e.stopPropagation(); props.onSync(data); }}
    >
      {props.syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
      Sync Now
    </Button>
  );
}

interface LegacyOrdersGridProps {
  orders: any[];
  onRowClicked: (orderId: string) => void;
  onSelectionChanged: (selectedIds: string[]) => void;
}

export function LegacyOrdersGrid({ orders, onRowClicked, onSelectionChanged }: LegacyOrdersGridProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const gridRef = useRef<AgGridReact>(null);
  const { syncSingleOrder, syncing } = useLegacyCourierSync();
  const postSettlement = usePostSettlement();

  const handleCellEdit = useCallback(async (event: CellValueChangedEvent) => {
    const { data, colDef, oldValue, newValue } = event;
    if (oldValue === newValue) return;

    const field = colDef.field as string;
    const orderId = data.id;

    // Map grid fields to DB fields
    const dbFieldMap: Record<string, string> = {
      "customers.full_name": "__customer_name",
      "customers.phone": "__customer_phone",
      total_amount: "total_amount",
      advance_amount: "advance_amount",
      advance_method: "advance_method",
      status: "status",
      legacy_courier_name: "legacy_courier_name",
      legacy_tracking_id: "legacy_tracking_id",
    };

    const dbField = dbFieldMap[field] || field;

    // Customer edits go to customers table
    if (dbField === "__customer_name" || dbField === "__customer_phone") {
      const customerId = data.customer_id;
      if (!customerId) { toast({ title: "No linked customer", variant: "destructive" }); return; }
      const customerField = dbField === "__customer_name" ? "full_name" : "phone";
      const { error } = await supabase.from("customers").update({ [customerField]: newValue }).eq("id", customerId);
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        event.node.setDataValue(field, oldValue);
        return;
      }
    } else {
      // Numeric validation
      if (["total_amount", "advance_amount"].includes(dbField)) {
        const num = parseFloat(newValue);
        if (isNaN(num) || num < 0) {
          toast({ title: "Invalid number", variant: "destructive" });
          event.node.setDataValue(field, oldValue);
          return;
        }
      }

      const { error } = await supabase.from("orders").update({ [dbField]: newValue }).eq("id", orderId);
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        event.node.setDataValue(field, oldValue);
        return;
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      entity_type: "order",
      entity_id: orderId,
      action: "inline_edit",
      before_json: { [field]: oldValue },
      after_json: { [field]: newValue },
    });

    toast({ title: "Updated", description: `${field}: ${oldValue} → ${newValue}` });
  }, [toast]);

  const handleSyncOrder = useCallback(async (data: any) => {
    const result = await syncSingleOrder(data.id, data.legacy_tracking_id);
    if (result.success) {
      // Update grid row
      const rowNode = gridRef.current?.api?.getRowNode(data.id);
      if (rowNode) {
        rowNode.setDataValue("courier_sync_status", "SYNCED");
        rowNode.setDataValue("courier_last_sync_at", new Date().toISOString());
        rowNode.setDataValue("courier_final_status", result.courierFinalStatus);
      }
      // Also update sync status in DB
      await supabase.from("orders").update({
        courier_sync_status: "SYNCED",
        courier_last_sync_at: new Date().toISOString(),
        courier_last_sync_error: null,
      }).eq("id", data.id);
    } else {
      await supabase.from("orders").update({
        courier_sync_status: "FAILED",
        courier_last_sync_at: new Date().toISOString(),
        courier_last_sync_error: result.error || "Unknown error",
      }).eq("id", data.id);
      const rowNode = gridRef.current?.api?.getRowNode(data.id);
      if (rowNode) {
        rowNode.setDataValue("courier_sync_status", "FAILED");
        rowNode.setDataValue("courier_last_sync_error", result.error);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["legacy-orders"] });
  }, [syncSingleOrder, queryClient]);

  const handlePostSettlement = useCallback(async (data: any) => {
    const calc = calculateNetPayable({
      collectable_amount: data.total_amount,
      courier_delivery_fee: data.courier_delivery_fee,
      courier_cod_fee: data.courier_cod_fee,
      courier_discount: data.courier_discount,
      courier_promo_discount: data.courier_promo_discount,
      courier_additional_charge: data.courier_additional_charge,
      courier_compensation_cost: data.courier_compensation_cost,
      is_return: data.courier_final_status === "RETURNED",
    });

    try {
      await postSettlement.mutateAsync({
        orderId: data.id,
        customerTotal: data.total_amount || 0,
        courierTotalCost: calc.totalCost,
        netPayable: calc.netPayable,
      });
      const rowNode = gridRef.current?.api?.getRowNode(data.id);
      if (rowNode) {
        rowNode.setDataValue("settlement_posted", true);
      }
    } catch {
      // Error handled by mutation
    }
  }, [postSettlement]);

  const getRowId = useCallback((params: GetRowIdParams) => params.data.id, []);

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 48,
      pinned: "left",
      suppressMovable: true,
      lockPosition: true,
      headerClass: "ag-checkbox-header",
    },
    {
      headerName: "Invoice",
      field: "order_number",
      pinned: "left",
      width: 130,
      editable: false,
      valueGetter: (p) => p.data?.order_number || p.data?.legacy_order_id || "—",
      cellStyle: { fontFamily: "monospace", fontSize: "12px", fontWeight: 600 },
    },
    {
      headerName: "Date",
      field: "order_date",
      width: 100,
      pinned: "left",
      editable: false,
      valueFormatter: (p) => formatDate(p.value),
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Customer",
      field: "customers.full_name",
      width: 140,
      pinned: "left",
      editable: true,
      valueGetter: (p) => p.data?.customers?.full_name || "—",
      valueSetter: (p) => { if (p.data.customers) p.data.customers.full_name = p.newValue; return true; },
    },
    {
      headerName: "Phone",
      field: "customers.phone",
      width: 120,
      editable: true,
      valueGetter: (p) => p.data?.customers?.phone || "",
      valueSetter: (p) => { if (p.data.customers) p.data.customers.phone = p.newValue; return true; },
      cellStyle: { fontFamily: "monospace", fontSize: "11px" },
    },
    {
      headerName: "District",
      field: "delivery_district",
      width: 100,
      editable: false,
      valueGetter: (p) => p.data?.delivery_district || p.data?.customers?.district || "—",
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Thana",
      field: "delivery_thana",
      width: 100,
      editable: false,
      valueGetter: (p) => p.data?.delivery_thana || p.data?.customers?.thana || "—",
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Items",
      width: 80,
      editable: false,
      valueGetter: (p) => {
        const items = p.data?.order_items || [];
        return `${items.length} item${items.length !== 1 ? "s" : ""}`;
      },
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Total",
      field: "total_amount",
      width: 100,
      pinned: "left",
      editable: true,
      type: "numericColumn",
      valueFormatter: (p) => formatBDT2(p.value),
      cellStyle: { fontWeight: 600, fontSize: "12px" },
    },
    {
      headerName: "Advance",
      field: "advance_amount",
      width: 90,
      editable: true,
      type: "numericColumn",
      valueFormatter: (p) => p.value > 0 ? formatBDT2(p.value) : "—",
      cellStyle: (p) => ({
        fontSize: "11px",
        color: p.value > 0 ? "hsl(160, 84%, 30%)" : undefined,
      }),
    },
    {
      headerName: "Adv. Method",
      field: "advance_method",
      width: 100,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ["", ...ADVANCE_METHODS] },
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Remaining",
      width: 95,
      editable: false,
      valueGetter: (p) => {
        const total = parseFloat(p.data?.total_amount) || 0;
        const adv = parseFloat(p.data?.advance_amount) || 0;
        return Math.max(0, total - adv);
      },
      valueFormatter: (p) => formatBDT2(p.value),
      cellStyle: (p) => ({
        fontSize: "11px",
        fontWeight: 600,
        color: p.value === 0 ? "hsl(160, 84%, 30%)" : "hsl(244, 100%, 69%)",
      }),
    },
    {
      headerName: "Legacy",
      field: "legacy_status",
      width: 90,
      editable: false,
      cellRenderer: BadgeCellRenderer,
    },
    {
      headerName: "ERP Status",
      field: "status",
      width: 110,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ERP_STATUSES },
      cellRenderer: BadgeCellRenderer,
    },
    {
      headerName: "Courier Final",
      field: "courier_final_status",
      width: 110,
      editable: false,
      cellRenderer: BadgeCellRenderer,
      valueGetter: (p) => p.data?.courier_final_status || "UNKNOWN",
    },
    {
      headerName: "Courier",
      field: "legacy_courier_name",
      width: 100,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ["", ...COURIER_NAMES] },
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Tracking ID",
      field: "legacy_tracking_id",
      width: 140,
      editable: true,
      cellStyle: { fontFamily: "monospace", fontSize: "11px" },
    },
    {
      headerName: "Courier Cost",
      field: "courier_total_cost",
      width: 95,
      editable: false,
      type: "numericColumn",
      valueFormatter: (p) => p.value > 0 ? formatBDT2(p.value) : "—",
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Net Payable",
      width: 100,
      editable: false,
      type: "numericColumn",
      valueGetter: (p) => {
        const d = p.data;
        if (!d?.courier_total_cost && !d?.courier_delivery_fee) return null;
        const calc = calculateNetPayable({
          collectable_amount: d.total_amount,
          courier_delivery_fee: d.courier_delivery_fee,
          courier_cod_fee: d.courier_cod_fee,
          courier_discount: d.courier_discount,
          courier_promo_discount: d.courier_promo_discount,
          courier_additional_charge: d.courier_additional_charge,
          courier_compensation_cost: d.courier_compensation_cost,
          is_return: d.courier_final_status === "RETURNED",
        });
        return calc.netPayable;
      },
      valueFormatter: (p) => p.value != null ? formatBDT2(p.value) : "—",
      cellStyle: { fontSize: "11px", fontWeight: 600 },
    },
    {
      headerName: "Settlement",
      width: 110,
      editable: false,
      cellRenderer: (params: ICellRendererParams) => (
        <SettlementCellRenderer {...params} onPost={handlePostSettlement} />
      ),
    },
    {
      headerName: "Sync",
      field: "courier_sync_status",
      width: 100,
      editable: false,
      cellRenderer: SyncBadgeRenderer,
      valueGetter: (p) => p.data?.courier_sync_status || "NOT_SYNCED",
    },
    {
      headerName: "Last Sync",
      field: "courier_last_sync_at",
      width: 110,
      editable: false,
      valueFormatter: (p) => p.value ? formatDateTime(p.value) : "—",
      cellStyle: { fontSize: "10px", color: "hsl(215, 16%, 47%)" },
    },
    {
      headerName: "",
      width: 90,
      editable: false,
      cellRenderer: (params: ICellRendererParams) => (
        <SyncActionRenderer {...params} onSync={handleSyncOrder} syncing={syncing} />
      ),
      suppressMovable: true,
    },
  ], [handleSyncOrder, handlePostSettlement, syncing]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    suppressHeaderMenuButton: true,
    cellStyle: { fontSize: "12px", display: "flex", alignItems: "center" },
  }), []);

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    const selected = event.api.getSelectedRows();
    onSelectionChanged(selected.map((r: any) => r.id));
  }, [onSelectionChanged]);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    // Auto-size non-pinned columns to fit
  }, []);

  const getRowStyle = useCallback((params: any) => {
    const data = params.data;
    if (data?.courier_sync_status === "FAILED") {
      return { backgroundColor: "hsl(0, 84%, 97%)" };
    }
    if (data?.settlement_posted) {
      return { backgroundColor: "hsl(160, 84%, 97%)" };
    }
    return undefined;
  }, []);

  return (
    <div className="ag-theme-alpine w-full" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
      <AgGridReact
        ref={gridRef}
        rowData={orders}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        rowSelection="multiple"
        suppressRowClickSelection={true}
        onSelectionChanged={handleSelectionChanged}
        onCellValueChanged={handleCellEdit}
        onRowClicked={(e) => {
          if (e.event?.defaultPrevented) return;
          onRowClicked(e.data?.id);
        }}
        onGridReady={onGridReady}
        getRowStyle={getRowStyle}
        animateRows={true}
        enableCellTextSelection={true}
        suppressCopyRowsToClipboard={false}
        clipboardDelimiter="\t"
        undoRedoCellEditing={true}
        undoRedoCellEditingLimit={20}
        stopEditingWhenCellsLoseFocus={true}
        headerHeight={36}
        rowHeight={38}
        tooltipShowDelay={300}
      />
    </div>
  );
}
