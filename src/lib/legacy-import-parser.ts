/**
 * Smart Legacy Order Import Parser
 * Handles product splitting, SKU matching, status mapping, and validation.
 */

// --- Product Parsing ---

export interface ParsedProduct {
  qty: number;
  productName: string;
}

/**
 * Split a products cell by comma and extract qty using ^(\d+)x pattern.
 * Example: "2x Water Ripple Lamp, 1x LED Strip" → [{qty:2, productName:"Water Ripple Lamp"}, {qty:1, productName:"LED Strip"}]
 */
export function parseProductsCell(raw: string): ParsedProduct[] {
  if (!raw || !raw.trim()) return [];
  const segments = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return segments.map((seg) => {
    const match = seg.match(/^(\d+)\s*x\s+(.+)/i);
    if (match) {
      return { qty: parseInt(match[1], 10), productName: match[2].trim() };
    }
    return { qty: 1, productName: seg.trim() };
  });
}

// --- SKU Parsing ---

export function parseSkusCell(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// --- Status Mapping ---

const STATUS_MAP: Record<string, string> = {
  delivered: "delivered",
  return: "returned",
  returned: "returned",
  partial: "partially_delivered",
  "partial delivery": "partially_delivered",
  "partial delivered": "partially_delivered",
  pending: "pending",
  cancelled: "cancelled",
  canceled: "cancelled",
  cancel: "cancelled",
  confirmed: "confirmed",
  shipped: "shipped",
  "in transit": "in_transit",
  "in_transit": "in_transit",
};

export function mapStatus(raw: string): string {
  if (!raw) return "pending";
  const key = raw.trim().toLowerCase();
  return STATUS_MAP[key] ?? "pending";
}

// --- Validation ---

export interface ParsedOrderRow {
  invoiceNumber: string;
  orderDate: string;
  customerName: string;
  phone: string;
  address: string;
  district: string;
  thana: string;
  products: ParsedProduct[];
  skus: string[];
  unitPrice: number;
  customerTotal: number;
  customerShipping: number;
  courierCodFee: number;
  courierDeliveryFee: number;
  advance: number;
  partialAmount: number;
  courierName: string;
  trackingId: string;
  rawStatus: string;
  mappedStatus: string;
  deliveredDate: string;
  returnedDate: string;
}

export interface ValidationError {
  row: number;
  invoiceNumber: string;
  field: string;
  message: string;
}

export interface ValidatedOrder {
  row: ParsedOrderRow;
  rowIndex: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  isValid: boolean;
}

export interface ValidationWarning {
  row: number;
  invoiceNumber: string;
  field: string;
  message: string;
}

export function validateOrder(
  order: ParsedOrderRow,
  rowIndex: number,
  existingInvoices: Set<string>,
  knownSkus: Set<string>,
  seenInvoices: Set<string>,
  strictSkuMatch: boolean = true
): ValidatedOrder {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const inv = order.invoiceNumber;

  // Invoice uniqueness
  if (!inv) {
    errors.push({ row: rowIndex, invoiceNumber: inv, field: "invoice_number", message: "Invoice number is empty" });
  } else if (existingInvoices.has(inv) || seenInvoices.has(inv)) {
    errors.push({ row: rowIndex, invoiceNumber: inv, field: "invoice_number", message: `Duplicate invoice: ${inv}` });
  }
  if (inv) seenInvoices.add(inv);

  // SKU vs product count mismatch
  if (order.skus.length > 0 && order.products.length > 0 && order.skus.length !== order.products.length) {
    // Relaxed mode: if SKU count is 1 and products > 1, replicate SKU to all products
    if (!strictSkuMatch && order.skus.length === 1 && order.products.length > 1) {
      const singleSku = order.skus[0];
      order.skus = order.products.map(() => singleSku);
      warnings.push({
        row: rowIndex,
        invoiceNumber: inv,
        field: "sku",
        message: `Single SKU "${singleSku}" applied to all ${order.products.length} products`,
      });
    } else {
      errors.push({
        row: rowIndex,
        invoiceNumber: inv,
        field: "sku",
        message: `SKU count (${order.skus.length}) doesn't match product count (${order.products.length})`,
      });
    }
  }

  // SKU existence
  for (const sku of order.skus) {
    if (sku && !knownSkus.has(sku.toUpperCase())) {
      errors.push({ row: rowIndex, invoiceNumber: inv, field: "sku", message: `SKU not found: ${sku}` });
    }
  }

  // Qty > 0
  for (let i = 0; i < order.products.length; i++) {
    if (order.products[i].qty <= 0) {
      errors.push({ row: rowIndex, invoiceNumber: inv, field: "qty", message: `Product "${order.products[i].productName}" has qty ≤ 0` });
    }
  }

  // Total validation
  if (order.products.length > 0 && order.unitPrice > 0) {
    const sumItems = order.products.reduce((s, p) => s + p.qty * order.unitPrice, 0);
    const expectedTotal = sumItems + (order.customerShipping || 0);
    if (order.customerTotal > 0 && Math.abs(expectedTotal - order.customerTotal) > 1) {
      errors.push({
        row: rowIndex,
        invoiceNumber: inv,
        field: "total",
        message: `Total mismatch: items(${sumItems}) + shipping(${order.customerShipping}) = ${expectedTotal}, but customer_total = ${order.customerTotal}`,
      });
    }
  }

  return { row: order, rowIndex, errors, warnings: warnings || [], isValid: errors.length === 0 };
}

// --- Error Report CSV ---

export function generateErrorCsv(errors: ValidationError[]): string {
  const header = "Row,Invoice Number,Field,Error Message";
  const lines = errors.map(
    (e) => `${e.row},"${(e.invoiceNumber || "").replace(/"/g, '""')}","${e.field}","${e.message.replace(/"/g, '""')}"`
  );
  return [header, ...lines].join("\n");
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Date helpers ---

export function parseExcelDate(val: any): string {
  if (!val) return "";
  if (typeof val === "object" && val.toISOString) return val.toISOString().slice(0, 10);
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}
