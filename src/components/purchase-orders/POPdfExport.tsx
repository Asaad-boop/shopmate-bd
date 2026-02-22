import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useCompanySettings } from "@/hooks/use-company-settings";

interface POItem {
  product_name?: string;
  unit?: string;
  quantity: number;
  unit_price_cny?: number | null;
  variant_note?: string;
  received_quantity?: number;
}

interface POPayment {
  payment_date: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id?: string;
}

interface POCost {
  label: string;
  amount_bdt: number;
}

interface POPdfExportProps {
  poNumber: string;
  status: string;
  orderDate: string;
  expectedArrival: string;
  actualArrival: string;
  supplierName: string;
  supplierWechat?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  cnyRate: number;
  shippingMethod: string;
  shippingAgent: string;
  trackingNumber: string;
  portOfEntry: string;
  items: POItem[];
  payments: POPayment[];
  additionalCosts: POCost[];
  productCostCny: number;
  productCostBdt: number;
  shippingCostCny: number;
  shippingCostBdt: number;
  additionalCostsBdt: number;
  grandTotalBdt: number;
  totalPaid: number;
  remaining: number;
  totalQty: number;
  costPerUnit: number;
}

export function POPdfExport(props: POPdfExportProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { settings: company } = useCompanySettings();

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${props.poNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; color: #1e293b; background: #fff; padding: 40px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #6c63ff; }
  .header-left h1 { font-size: 22px; font-weight: 800; color: #6c63ff; margin-bottom: 4px; }
  .header-left p { color: #64748b; font-size: 11px; }
  .header-right { text-align: right; }
  .header-right h2 { font-size: 24px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; }
  .header-right .po-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 6px; }
  .badge-draft { background: #f1f5f9; color: #64748b; }
  .badge-ordered { background: #dbeafe; color: #2563eb; }
  .badge-shipped, .badge-in_transit { background: #f3e8ff; color: #7c3aed; }
  .badge-customs { background: #ffedd5; color: #ea580c; }
  .badge-received { background: #d1fae5; color: #059669; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
  .info-box h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6c63ff; margin-bottom: 10px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
  .info-row .label { color: #64748b; }
  .info-row .value { font-weight: 600; color: #1e293b; }

  .rate-banner { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #f59e0b; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
  .rate-banner span { font-size: 11px; color: #92400e; }
  .rate-banner strong { font-size: 14px; color: #78350f; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #6c63ff; color: #fff; padding: 10px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  thead th:first-child { border-radius: 8px 0 0 0; }
  thead th:last-child { border-radius: 0 8px 0 0; text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  tbody tr:hover { background: #fafafa; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  tfoot td { padding: 10px 12px; font-weight: 700; font-size: 12px; background: #f8fafc; }

  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .cost-summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
  .cost-summary h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6c63ff; margin-bottom: 12px; }
  .cost-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
  .cost-row .label { color: #64748b; }
  .cost-row .value { font-weight: 600; }
  .grand-total { display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #6c63ff; margin-top: 10px; font-size: 15px; font-weight: 800; color: #6c63ff; }

  .payment-table thead th { background: #10b981; }
  .payment-table thead th:first-child { border-radius: 8px 0 0 0; }
  .payment-table thead th:last-child { border-radius: 0 8px 0 0; }

  .payment-summary { background: linear-gradient(135deg, #6c63ff, #8b5cf6); border-radius: 10px; padding: 16px; color: #fff; }
  .payment-summary h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.7); margin-bottom: 12px; }
  .payment-summary .cost-row .label { color: rgba(255,255,255,0.7); }
  .payment-summary .cost-row .value { color: #fff; }
  .payment-summary .grand-total { border-top-color: rgba(255,255,255,0.3); color: #fff; }
  .remaining-red { color: #fca5a5 !important; }

  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }

  @media print {
    body { padding: 20px; }
    @page { margin: 15mm; size: A4; }
  }
</style></head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const fmt = (n: number) => `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtCny = (n: number) => `¥${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const statusClass = `badge-${props.status}`;

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={handlePrint}>
        <Download className="w-4 h-4" /> Export PDF
      </Button>

      {/* Hidden print content */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={printRef}>
          {/* Header */}
          <div className="header">
            <div className="header-left">
              <h1>{company?.name || "Company"}</h1>
              <p>{company?.address1 || ""}{company?.city ? `, ${company.city}` : ""}</p>
              <p>{company?.phone || ""}{company?.email ? ` • ${company.email}` : ""}</p>
            </div>
            <div className="header-right">
              <h2>{props.poNumber}</h2>
              <div className={`po-badge ${statusClass}`}>{props.status.replace("_", " ")}</div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="info-grid">
            <div className="info-box">
              <h3>Supplier Details</h3>
              <div className="info-row"><span className="label">Name</span><span className="value">🇨🇳 {props.supplierName || "—"}</span></div>
              {props.supplierWechat && <div className="info-row"><span className="label">WeChat</span><span className="value">{props.supplierWechat}</span></div>}
              {props.supplierPhone && <div className="info-row"><span className="label">Phone</span><span className="value">{props.supplierPhone}</span></div>}
              {props.supplierEmail && <div className="info-row"><span className="label">Email</span><span className="value">{props.supplierEmail}</span></div>}
            </div>
            <div className="info-box">
              <h3>Order Details</h3>
              <div className="info-row"><span className="label">Order Date</span><span className="value">{props.orderDate || "—"}</span></div>
              <div className="info-row"><span className="label">Expected Arrival</span><span className="value">{props.expectedArrival || "—"}</span></div>
              {props.actualArrival && <div className="info-row"><span className="label">Actual Arrival</span><span className="value">{props.actualArrival}</span></div>}
              <div className="info-row"><span className="label">Shipping</span><span className="value">{props.shippingMethod}{props.shippingAgent ? ` (${props.shippingAgent})` : ""}</span></div>
              {props.trackingNumber && <div className="info-row"><span className="label">Tracking</span><span className="value">{props.trackingNumber}</span></div>}
              <div className="info-row"><span className="label">Port of Entry</span><span className="value">{props.portOfEntry}</span></div>
            </div>
          </div>

          {/* Exchange Rate */}
          <div className="rate-banner">
            <span>Exchange Rate:</span>
            <strong>1 CNY = {props.cnyRate} BDT</strong>
          </div>

          {/* Products Table */}
          <table>
            <thead>
              <tr>
                <th style={{ width: "5%" }}>#</th>
                <th style={{ width: "30%" }}>Product</th>
                <th style={{ width: "8%" }} className="text-center">Unit</th>
                <th style={{ width: "8%" }} className="text-center">Qty</th>
                <th className="text-right">Unit (CNY)</th>
                <th className="text-right">Unit (BDT)</th>
                <th className="text-right">Total (CNY)</th>
                <th style={{ width: "15%" }} className="text-right">Total (BDT)</th>
              </tr>
            </thead>
            <tbody>
              {props.items.filter(it => it.quantity > 0).map((it, i) => {
                const unitCny = it.unit_price_cny || 0;
                const totalCny = it.quantity * unitCny;
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{it.product_name || "Unnamed"}</strong>
                      {it.variant_note && <br />}
                      {it.variant_note && <span style={{ color: "#64748b", fontSize: "10px" }}>{it.variant_note}</span>}
                    </td>
                    <td className="text-center">{it.unit || "pcs"}</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{it.quantity}</td>
                    <td className="text-right">{fmtCny(unitCny)}</td>
                    <td className="text-right">{fmt(unitCny * props.cnyRate)}</td>
                    <td className="text-right">{fmtCny(totalCny)}</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{fmt(totalCny * props.cnyRate)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="text-center">{props.totalQty}</td>
                <td colSpan={2}></td>
                <td className="text-right">{fmtCny(props.productCostCny)}</td>
                <td className="text-right">{fmt(props.productCostBdt)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Cost Summary + Payment Summary */}
          <div className="summary-grid">
            <div className="cost-summary">
              <h3>Cost Breakdown</h3>
              <div className="cost-row"><span className="label">Product Cost (CNY)</span><span className="value">{fmtCny(props.productCostCny)}</span></div>
              <div className="cost-row"><span className="label">Product Cost (BDT)</span><span className="value">{fmt(props.productCostBdt)}</span></div>
              <div className="cost-row"><span className="label">Shipping (CNY)</span><span className="value">{fmtCny(props.shippingCostCny)}</span></div>
              <div className="cost-row"><span className="label">Shipping (BDT)</span><span className="value">{fmt(props.shippingCostBdt)}</span></div>
              {props.additionalCosts.map((c, i) => (
                <div className="cost-row" key={i}><span className="label">{c.label}</span><span className="value">{fmt(c.amount_bdt)}</span></div>
              ))}
              <div className="cost-row"><span className="label">Cost per Unit</span><span className="value">{fmt(props.costPerUnit)}</span></div>
              <div className="grand-total"><span>Grand Total</span><span>{fmt(props.grandTotalBdt)}</span></div>
            </div>

            <div className="payment-summary">
              <h3>Payment Status</h3>
              <div className="cost-row"><span className="label">Grand Total</span><span className="value">{fmt(props.grandTotalBdt)}</span></div>
              <div className="cost-row"><span className="label">Total Paid</span><span className="value">{fmt(props.totalPaid)}</span></div>
              <div className="cost-row"><span className="label">Remaining</span><span className={`value ${props.remaining > 0 ? "remaining-red" : ""}`}>{fmt(props.remaining > 0 ? props.remaining : 0)}</span></div>
              <div className="grand-total"><span>Paid %</span><span>{props.grandTotalBdt > 0 ? Math.round((props.totalPaid / props.grandTotalBdt) * 100) : 0}%</span></div>
            </div>
          </div>

          {/* Payment History */}
          {props.payments.length > 0 && (
            <>
              <h3 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#10b981", marginBottom: "8px" }}>Payment History</h3>
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Transaction ID</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {props.payments.map((p, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{p.payment_date}</td>
                      <td>{p.payment_method}</td>
                      <td>{p.transaction_id || "—"}</td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{p.currency === "CNY" ? fmtCny(p.amount) : fmt(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Footer */}
          <div className="footer">
            <span>Generated on {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
            <span>{company?.name || "Company"} • {company?.website || ""}</span>
          </div>
        </div>
      </div>
    </>
  );
}
