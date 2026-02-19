import { formatBDT, formatDate } from "@/lib/format";
import { numberToWords } from "@/lib/number-to-words";
import type { CompanySettings } from "@/hooks/use-company-settings";
import type { InvoiceSettings } from "@/hooks/use-invoice-settings";

/* ── shared helpers ── */

const DEFAULT_TERMS = `1. If any defect is found (damaged/defective/wrong product) after opening the box, inform us immediately with picture/video proof.
2. Return process must be initiated within 3 days of receiving the parcel.
3. Product must be in original condition with all tags and packaging.
4. Exchange delivery cost may be applicable.
5. Promotional offers are not applicable for returned products.`;

function formatDateISO(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toISOString().slice(0, 10);
}

function getPaymentLabel(method: string | null | undefined): string {
  if (!method) return 'Cash On Delivery';
  const m = method.toLowerCase();
  if (m === 'cod' || m === 'cash_on_delivery') return 'Cash On Delivery';
  if (m === 'bkash') return 'bKash';
  if (m === 'nagad') return 'Nagad';
  if (m === 'paid' || m === 'online') return 'Online Payment';
  return method;
}

/* ── CSS per paper size ── */

function getCSS(size: "a4" | "a5") {
  const isA5 = size === "a5";
  const f = isA5 ? 0.7 : 1; // scale factor
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; color: #111; background: #fff; }
    .invoice-page { width: ${isA5 ? '148mm' : '210mm'}; min-height: ${isA5 ? '210mm' : '297mm'}; padding: ${isA5 ? '5mm 6mm' : '10mm 12mm'}; margin: 0 auto; position: relative; display: flex; flex-direction: column; }

    /* SECTION 1: Top header */
    .top-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: ${8 * f}px; border-bottom: 2px solid #111; margin-bottom: ${12 * f}px; }
    .top-left { display: flex; flex-direction: column; gap: ${2 * f}px; max-width: 35%; }
    .top-left img { max-height: ${isA5 ? '35px' : '55px'}; object-fit: contain; }
    .top-left .co-name { font-size: ${isA5 ? '14px' : '20px'}; font-weight: 800; letter-spacing: -0.5px; }
    .top-right { display: flex; gap: ${isA5 ? '12px' : '24px'}; text-align: left; align-items: flex-start; }
    .top-right .col { font-size: ${isA5 ? '7px' : '9.5px'}; line-height: 1.5; color: #333; }
    .top-right .col strong { font-size: ${isA5 ? '7.5px' : '10px'}; color: #111; display: block; margin-bottom: 2px; }
    .top-barcode { text-align: right; }
    .top-barcode svg { height: ${isA5 ? '35px' : '50px'}; width: ${isA5 ? '120px' : '180px'}; }
    .top-barcode .bc-label { font-size: ${isA5 ? '7px' : '9px'}; color: #333; font-family: monospace; text-align: center; margin-top: 1px; }

    /* SECTION 2: Invoice info */
    .invoice-info { display: flex; justify-content: space-between; gap: ${16 * f}px; margin-bottom: ${14 * f}px; }
    .delivery-box { flex: 0 0 45%; }
    .delivery-label { font-size: ${isA5 ? '8px' : '10px'}; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: ${4 * f}px; }
    .delivery-name { font-size: ${isA5 ? '13px' : '18px'}; font-weight: 800; text-transform: uppercase; margin-bottom: ${3 * f}px; letter-spacing: 0.3px; }
    .delivery-addr { font-size: ${isA5 ? '8.5px' : '11px'}; color: #333; line-height: 1.5; margin-bottom: ${4 * f}px; }
    .delivery-phone { font-size: ${isA5 ? '11px' : '15px'}; font-weight: 700; font-family: monospace; letter-spacing: 2px; line-height: 1.6; }

    .invoice-detail { flex: 0 0 50%; }
    .invoice-title { font-size: ${isA5 ? '22px' : '32px'}; font-weight: 900; margin-bottom: ${6 * f}px; }
    .inv-table { width: 100%; font-size: ${isA5 ? '8.5px' : '11px'}; }
    .inv-table td { padding: ${2 * f}px 0; vertical-align: top; }
    .inv-table td:first-child { color: #666; font-weight: 500; width: 35%; }
    .inv-table td:last-child { font-weight: 600; }
    .inv-table .payable td:last-child { font-size: ${isA5 ? '14px' : '18px'}; font-weight: 800; }
    

    /* SECTION 3: Items table */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: ${10 * f}px; font-size: ${isA5 ? '8px' : '10.5px'}; }
    .items-table thead { border-top: 2px solid #111; border-bottom: 2px solid #111; }
    .items-table th { padding: ${isA5 ? '4px 3px' : '7px 6px'}; text-align: left; font-weight: 700; font-size: ${isA5 ? '7.5px' : '10px'}; text-transform: uppercase; color: #333; }
    .items-table td { padding: ${isA5 ? '5px 3px' : '8px 6px'}; vertical-align: middle; border-bottom: 1px solid #eee; }
    .items-table tr:nth-child(even) { background: #fafafa; }
    .items-table .pname { font-weight: 600; }
    .items-table .img-cell { width: ${isA5 ? '30px' : '50px'}; }
    .items-table .img-cell img { width: ${isA5 ? '28px' : '44px'}; height: ${isA5 ? '28px' : '44px'}; object-fit: cover; border-radius: 6px; border: 1px solid #eee; }
    .items-table .img-cell .initial { width: ${isA5 ? '28px' : '44px'}; height: ${isA5 ? '28px' : '44px'}; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: ${isA5 ? '10px' : '14px'}; color: #64748b; }
    .items-table .qty-highlight { font-weight: 800; color: #fff; background: #FF0000; padding: 3px 8px; border-radius: 4px; min-width: 30px; display: inline-block; text-align: center; font-size: ${isA5 ? '10px' : '13px'}; box-shadow: 0 0 8px rgba(255,0,0,0.6); }
    .items-table .r { text-align: right; }
    .note-row { background: #fef9c3 !important; }
    .note-row td { font-weight: 600; font-size: ${isA5 ? '8px' : '10.5px'}; color: #854d0e; padding: ${isA5 ? '4px 6px' : '8px 10px'}; }

    /* SECTION 4: Totals */
    .totals-section { display: flex; justify-content: flex-end; margin-bottom: ${10 * f}px; }
    .totals-box { width: ${isA5 ? '55%' : '45%'}; }
    .totals-row { display: flex; justify-content: space-between; padding: ${3 * f}px 0; font-size: ${isA5 ? '9px' : '12px'}; color: #333; }
    .totals-row.discount { color: #dc2626; }
    .totals-divider { border-top: 2px solid #111; margin: ${3 * f}px 0; }
    .totals-row.total { font-size: ${isA5 ? '13px' : '17px'}; font-weight: 800; color: #111; }
    .totals-row.total .vat-note { font-size: ${isA5 ? '7px' : '9px'}; font-weight: 400; color: #666; display: block; }
    .in-words { text-align: right; font-size: ${isA5 ? '8px' : '10.5px'}; margin-top: ${4 * f}px; color: #333; }
    .in-words strong { color: #111; }

    /* SECTION 5: Footer */
    .footer-section { margin-top: auto; padding-top: ${10 * f}px; border-top: 2px solid #111; display: flex; justify-content: space-between; align-items: flex-end; gap: ${12 * f}px; }
    .footer-left { }
    .footer-left svg { height: ${isA5 ? '35px' : '60px'}; margin-bottom: ${4 * f}px; }
    .footer-left .thanks { font-size: ${isA5 ? '9px' : '12px'}; font-weight: 800; text-transform: uppercase; }
    .footer-left .feedback { font-size: ${isA5 ? '6.5px' : '8.5px'}; color: #666; text-transform: uppercase; }
    .footer-left .f-email { font-size: ${isA5 ? '7px' : '9px'}; color: #333; margin-top: 2px; }
    .footer-right { text-align: right; }
    .footer-right .social { display: flex; gap: 6px; justify-content: flex-end; margin-bottom: 4px; }
    .footer-right .social span { width: ${isA5 ? '14px' : '18px'}; height: ${isA5 ? '14px' : '18px'}; border-radius: 4px; background: #111; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: ${isA5 ? '7px' : '9px'}; font-weight: 700; }
    .footer-right .f-line { font-size: ${isA5 ? '7px' : '9px'}; color: #333; }
    .footer-right .f-line strong { font-size: ${isA5 ? '7.5px' : '9.5px'}; }

    /* SECTION 6: Terms */
    .terms-section { margin-top: ${8 * f}px; padding-top: ${6 * f}px; border-top: 1px solid #ddd; }
    .terms-section p { font-size: ${isA5 ? '6px' : '8px'}; color: #888; line-height: 1.5; margin-bottom: ${2 * f}px; }
    .terms-section .confidential { font-size: ${isA5 ? '5.5px' : '7px'}; color: #aaa; text-align: center; margin-top: ${4 * f}px; font-style: italic; }
    .terms-section .copyright { font-size: ${isA5 ? '6px' : '7.5px'}; color: #aaa; text-align: center; margin-top: ${3 * f}px; }

    @media print {
      @page { size: ${isA5 ? 'A5' : 'A4'} portrait; margin: 0; }
      html, body { width: ${isA5 ? '148mm' : '210mm'}; }
      .invoice-page { padding: ${isA5 ? '5mm' : '10mm'}; min-height: ${isA5 ? '210mm' : '297mm'}; }
      .no-print { display: none !important; }
      .page-break { page-break-after: always; }
    }
  `;
}

/* ── build single invoice HTML ── */

function buildInvoiceHTML(order: any, company: CompanySettings | undefined, inv: InvoiceSettings | undefined, index: number): string {
  const items = order.order_items || [];
  const customer = order.customers;
  const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
  const subtotal = order.subtotal || items.reduce((s: number, i: any) => s + (i.total_price || 0), 0);
  const showVat = inv?.showVat && inv.vatPercentage > 0;
  const addr = [company?.address1, company?.address2, company?.city].filter(Boolean).join(', ');

  return `
    <div class="invoice-page ${index > 0 ? 'page-break' : ''}">

      <!-- SECTION 1: Top Header -->
      <div class="top-header">
        <div class="top-left">
          ${company?.logo
            ? `<img src="${company.logo}" alt="Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/><span class="co-name" style="display:none">${company?.name || ''}</span>`
            : `<span class="co-name">${company?.name || 'Company'}</span>`}
          ${company?.logo ? `<span class="co-name">${company?.name || ''}</span>` : ''}
        </div>
        <div class="top-right">
          <div class="col">
            <strong>HQ</strong>
            ${addr || 'Company Address'}<br>
            ${company?.phone ? `Hotline: ${company.phone}` : ''}
          </div>
          ${inv?.showBarcode !== false ? `<div class="top-barcode"><svg id="bc-top-${index}"></svg><div class="bc-label">${order.order_number}</div></div>` : ''}
        </div>
      </div>

      <!-- SECTION 2: Invoice Info -->
      <div class="invoice-info">
        <div class="delivery-box">
          <div class="delivery-label">Delivery Address</div>
          <div class="delivery-name">${customer?.full_name || '-'}</div>
          <div class="delivery-addr">${order.delivery_address || customer?.address || '-'}</div>
          <div class="delivery-phone">${customer?.phone || ''}</div>
          ${customer?.phone2 ? `<div class="delivery-phone">${customer.phone2}</div>` : ''}
        </div>
        <div class="invoice-detail">
          <div class="invoice-title">Invoice</div>
          <table class="inv-table">
            <tr><td>Invoice ID:</td><td>${order.order_number}</td></tr>
            <tr><td>Date:</td><td>${formatDateISO(order.order_date)}</td></tr>
            <tr><td>Item Count:</td><td>${totalQty}</td></tr>
            <tr><td>Payment:</td><td><strong>${getPaymentLabel(order.payment_method)}</strong></td></tr>
            <tr class="payable"><td>Payable:</td><td>BDT ${Number(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td></tr>
          </table>
        </div>
      </div>

      <!-- SECTION 3: Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th class="img-cell"></th>
            <th>Type</th>
            <th>Size</th>
            <th class="r">Price</th>
            <th class="r">Qty</th>
            <th class="r">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((i: any, idx: number) => {
            const prod = i.products as any;
            const name = prod?.name || '-';
            const initial = name.charAt(0).toUpperCase();
            const imgHtml = prod?.image_url
              ? `<img src="${prod.image_url}" alt="" onerror="this.outerHTML='<div class=\\'initial\\'>${initial}</div>'" />`
              : `<div class="initial">${initial}</div>`;
            const qtyHtml = i.quantity > 1
              ? `<span class="qty-highlight">${i.quantity}</span>`
              : `${i.quantity}`;
            return `<tr>
              <td>${idx + 1}.</td>
              <td class="pname">${name}</td>
              <td class="img-cell">${imgHtml}</td>
              <td>${prod?.category || ''}</td>
              <td>${prod?.variant || ''}</td>
              <td class="r">${Number(i.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
              <td class="r">${qtyHtml}</td>
              <td class="r" style="font-weight:600">${Number(i.total_price).toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
            </tr>`;
          }).join('')}
          ${order.notes ? `<tr class="note-row"><td colspan="8">📝 Note: ${order.notes}</td></tr>` : ''}
        </tbody>
      </table>

      <!-- SECTION 4: Totals -->
      <div class="totals-section">
        <div class="totals-box">
          <div class="totals-row"><span>Sub Total:</span><span>BDT ${Number(subtotal).toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span></div>
          <div class="totals-row"><span>Shipping Fee(+):</span><span>BDT ${Number(order.delivery_charge || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span></div>
          ${order.discount ? `<div class="totals-row discount"><span>Discount(-):</span><span>BDT ${Number(order.discount).toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span></div>` : ''}
          <div class="totals-divider"></div>
          <div class="totals-row total">
            <span>Total:</span>
            <span>
              BDT ${Number(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
          </div>
          <div class="in-words"><strong>In Words:</strong> ${numberToWords(order.total_amount)} Tk Only</div>
        </div>
      </div>

      <!-- SECTION 5: Footer -->
      <div class="footer-section">
        <div class="footer-left">
          ${inv?.showBarcode !== false ? `<svg id="bc-footer-${index}"></svg>` : ''}
          <div class="thanks">THANK YOU FOR CHOOSING US</div>
          <div class="feedback">YOUR FEEDBACK KEEPS US IMPROVING</div>
          ${company?.email ? `<div class="f-email">${company.email}</div>` : ''}
        </div>
        <div class="footer-right">
          <div class="social">
            ${company?.facebook ? '<span>f</span>' : ''}
            ${company?.website ? '<span>🌐</span>' : ''}
          </div>
          ${company?.website ? `<div class="f-line">VISIT US: <strong>${company.website}</strong></div>` : ''}
          ${company?.phone ? `<div class="f-line">SUPPORT: <strong>${company.phone}</strong></div>` : ''}
        </div>
      </div>

      <!-- SECTION 6: Terms -->
      <div class="terms-section">
        <p>${(inv?.terms || DEFAULT_TERMS).replace(/\n/g, '<br>')}</p>
        <div class="confidential">This document & any information transmitted with it are confidential & intended solely for the use of the individual or entity to whom they are addressed.</div>
        <div class="copyright">© ${new Date().getFullYear()} ${company?.name || 'Company'}. All Rights Reserved</div>
      </div>

    </div>
  `;
}

/* ── PUBLIC API ── */

export function printInvoice(order: any, company?: CompanySettings, inv?: InvoiceSettings, paperSize?: "a4" | "a5") {
  const size = paperSize || inv?.defaultPaperSize || "a4";
  const html = `
    <html><head>
      <title>Invoice - ${order.order_number}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
      <style>${getCSS(size)}</style>
    </head><body>
      ${buildInvoiceHTML(order, company, inv, 0)}
      <script>
        try{JsBarcode("#bc-top-0","${order.order_number}",{format:"CODE128",height:${size === 'a5' ? 30 : 45},displayValue:false,margin:0,width:${size === 'a5' ? 1.2 : 1.5}});}catch(e){}
        try{JsBarcode("#bc-footer-0","${order.order_number}",{format:"CODE128",height:${size === 'a5' ? 30 : 50},displayValue:false,margin:0});}catch(e){}
      <\/script>
    </body></html>
  `;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

export function printBulkInvoices(orders: any[], company?: CompanySettings, inv?: InvoiceSettings, paperSize?: "a4" | "a5") {
  const size = paperSize || inv?.defaultPaperSize || "a4";
  const invoicesHTML = orders.map((o, i) => buildInvoiceHTML(o, company, inv, i)).join('');
  const barcodeScripts = orders.map((o, i) => `
    try{JsBarcode("#bc-top-${i}","${o.order_number}",{format:"CODE128",height:${size === 'a5' ? 30 : 45},displayValue:false,margin:0,width:${size === 'a5' ? 1.2 : 1.5}});}catch(e){}
    try{JsBarcode("#bc-footer-${i}","${o.order_number}",{format:"CODE128",height:${size === 'a5' ? 30 : 50},displayValue:false,margin:0});}catch(e){}
  `).join('\n');

  const html = `
    <html><head>
      <title>Invoices - Bulk Print</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
      <style>${getCSS(size)}</style>
    </head><body>
      ${invoicesHTML}
      <script>${barcodeScripts}<\/script>
    </body></html>
  `;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

/* ── Keep legacy exports for picking list, packing slip, barcode labels ── */

function companyHeaderSmall(c: CompanySettings | undefined) {
  const logo = c?.logo
    ? `<img src="${c.logo}" alt="" style="max-height:30px;object-fit:contain;margin-right:8px;vertical-align:middle" onerror="this.style.display='none'"/>`
    : '';
  return `${logo}<strong>${c?.name || 'Company'}</strong>${c?.phone ? ` | ${c.phone}` : ''}`;
}

export function printPickingList(orders: any[], company?: CompanySettings) {
  const allItems: { orderNumber: string; customer: string; sku: string; name: string; qty: number }[] = [];
  orders.forEach((o) => {
    (o.order_items || []).forEach((item: any) => {
      allItems.push({
        orderNumber: o.order_number,
        customer: (o.customers as any)?.full_name || '-',
        sku: (item.products as any)?.sku || '-',
        name: (item.products as any)?.name || '-',
        qty: item.quantity,
      });
    });
  });
  allItems.sort((a, b) => a.sku.localeCompare(b.sku));

  const html = `
    <html><head><title>Picking List</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 18px; margin: 0; }
      .header { display: flex; align-items: center; gap: 12px; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 6px 10px; font-size: 14px; }
      th { background: #eee; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <div class="header">
      ${company?.logo ? `<img src="${company.logo}" alt="" style="max-height:40px;object-fit:contain" onerror="this.style.display='none'"/>` : ''}
      <div>
        <h1>📋 PICKING LIST</h1>
        <p style="font-size:12px;margin:2px 0">${company?.name || ''} | ${new Date().toLocaleDateString()} | ${orders.length} orders | ${allItems.length} items</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Order #</th><th>Customer</th><th>SKU</th><th>Product</th><th>Qty</th><th>☐</th></tr></thead>
      <tbody>${allItems.map((i) => `<tr><td>${i.orderNumber}</td><td>${i.customer}</td><td>${i.sku}</td><td>${i.name}</td><td>${i.qty}</td><td></td></tr>`).join('')}</tbody>
    </table>
    </body></html>
  `;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export function printPackingSlip(order: any, company?: CompanySettings) {
  const items = order.order_items || [];
  const html = `
    <html><head><title>Packing Slip - ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; max-width: 500px; }
      h1 { font-size: 24px; text-align: center; margin-bottom: 5px; }
      p { font-size: 13px; margin: 3px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 13px; }
      .company-bar { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 10px; font-size: 12px; }
      @page { size: A5; }
    </style></head><body>
    <div class="company-bar">
      ${company?.logo ? `<img src="${company.logo}" alt="" style="max-height:35px;object-fit:contain;margin-bottom:4px" onerror="this.style.display='none'"/><br>` : ''}
      <strong>${company?.name || ''}</strong>
      ${company?.phone ? ` | ${company.phone}` : ''}
      ${company?.website ? ` | ${company.website}` : ''}
    </div>
    <h1>${order.order_number}</h1>
    <p style="text-align:center;font-size:11px;color:#666">Thank you for your order!</p>
    <hr style="margin:8px 0">
    <p><strong>${(order.customers as any)?.full_name || '-'}</strong></p>
    <p>${order.delivery_address || (order.customers as any)?.address || ''}</p>
    <p>${(order.customers as any)?.phone || ''}</p>
    <table>
      <thead><tr><th>Product</th><th>Qty</th></tr></thead>
      <tbody>${items.map((i: any) => `<tr><td>${(i.products as any)?.name || '-'}</td><td>${i.quantity}</td></tr>`).join('')}</tbody>
    </table>
    ${order.notes ? `<p style="margin-top:10px"><strong>Note:</strong> ${order.notes}</p>` : ''}
    </body></html>
  `;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export function printBarcodeLabels(orders: any[], company?: CompanySettings) {
  const labels = orders.map((o) => ({
    orderNumber: o.order_number,
    customer: (o.customers as any)?.full_name || '-',
    phone: (o.customers as any)?.phone || '-',
    address: o.delivery_address || (o.customers as any)?.address || '',
    cod: o.payment_method?.toLowerCase() === 'cod' ? o.total_amount : 0,
  }));

  const companyLine = company?.name || '';

  const html = `
    <html><head><title>Barcode Labels</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
    <style>
      body { font-family: Arial, sans-serif; padding: 10px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .label { border: 1px solid #000; padding: 10px; page-break-inside: avoid; }
      .label p { margin: 2px 0; font-size: 11px; }
      .label .company { font-size: 9px; color: #666; margin-bottom: 4px; }
      .label .order-num { font-size: 14px; font-weight: bold; }
      svg { max-width: 100%; height: 40px; }
      @media print { .grid { gap: 5px; } }
    </style></head><body>
    <div class="grid">
      ${labels.map((l, i) => `
        <div class="label">
          <p class="company">${companyLine}</p>
          <svg id="bc-${i}"></svg>
          <p class="order-num">${l.orderNumber}</p>
          <p>${l.customer}</p>
          <p>${l.phone}</p>
          <p style="font-size:10px">${l.address}</p>
          ${l.cod ? `<p><strong>COD: ৳${l.cod}</strong></p>` : ''}
        </div>
      `).join('')}
    </div>
    <script>
      ${labels.map((l, i) => `try{JsBarcode("#bc-${i}", "${l.orderNumber}", {height:35,displayValue:false,margin:0});}catch(e){}`).join('\n')}
      setTimeout(()=>window.print(), 500);
    <\/script>
    </body></html>
  `;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}
