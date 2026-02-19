import { formatBDT, formatDate } from "@/lib/format";
import type { CompanySettings } from "@/hooks/use-company-settings";

function companyHeader(c: CompanySettings | undefined) {
  const logo = c?.logo
    ? `<img src="${c.logo}" alt="Logo" style="max-height:60px;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/><span style="display:none;font-size:22px;font-weight:bold">${c?.name || ''}</span>`
    : `<span style="font-size:22px;font-weight:bold">${c?.name || 'Company'}</span>`;

  const info = [c?.phone, c?.email].filter(Boolean).join(" | ");
  const addr = [c?.address1, c?.address2, c?.city].filter(Boolean).join(", ");

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:12px">
      <div>
        ${logo}
        ${c?.tagline ? `<p style="font-size:11px;color:#666;margin:2px 0">${c.tagline}</p>` : ''}
        ${info ? `<p style="font-size:11px;color:#666;margin:2px 0">${info}</p>` : ''}
        ${addr ? `<p style="font-size:11px;color:#666;margin:2px 0">${addr}</p>` : ''}
      </div>
    </div>
  `;
}

function companyHeaderSmall(c: CompanySettings | undefined) {
  const logo = c?.logo
    ? `<img src="${c.logo}" alt="" style="max-height:30px;object-fit:contain;margin-right:8px;vertical-align:middle" onerror="this.style.display='none'"/>`
    : '';
  return `${logo}<strong>${c?.name || 'Company'}</strong>${c?.phone ? ` | ${c.phone}` : ''}`;
}

export function printInvoice(order: any, company?: CompanySettings) {
  const items = order.order_items || [];
  const customer = order.customers;
  const subtotal = order.subtotal || items.reduce((s: number, i: any) => s + (i.total_price || 0), 0);

  const html = `
    <html><head><title>Invoice - ${order.order_number}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1a1a2e; max-width: 800px; margin: 0 auto; font-size: 13px; line-height: 1.5; }

      .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid #2563eb; margin-bottom: 28px; }
      .header-left { display: flex; flex-direction: column; gap: 4px; }
      .header-left img { max-height: 52px; object-fit: contain; margin-bottom: 4px; }
      .company-name { font-size: 22px; font-weight: 700; color: #1e293b; letter-spacing: -0.3px; }
      .company-detail { font-size: 11px; color: #64748b; }

      .invoice-badge { text-align: right; }
      .invoice-title { font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; text-transform: uppercase; }
      .invoice-num { font-size: 13px; font-weight: 600; color: #334155; margin-top: 4px; }
      .invoice-date { font-size: 12px; color: #64748b; margin-top: 2px; }

      .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
      .party-box { padding: 16px; border-radius: 8px; }
      .party-box.from { background: #f1f5f9; }
      .party-box.to { background: #eff6ff; border: 1px solid #bfdbfe; }
      .party-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
      .party-name { font-size: 15px; font-weight: 600; color: #1e293b; }
      .party-info { font-size: 12px; color: #475569; margin-top: 2px; }

      table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 24px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
      thead { background: #1e293b; }
      th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; }
      th:last-child, td:last-child { text-align: right; }
      th:nth-child(3), td:nth-child(3), th:nth-child(4), td:nth-child(4) { text-align: center; }
      td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
      tr:last-child td { border-bottom: none; }
      tr:nth-child(even) { background: #f8fafc; }

      .summary { display: flex; justify-content: flex-end; margin-bottom: 28px; }
      .summary-box { width: 280px; }
      .summary-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; color: #475569; }
      .summary-row.discount { color: #dc2626; }
      .summary-divider { border-top: 1px dashed #cbd5e1; margin: 4px 0; }
      .summary-total { display: flex; justify-content: space-between; padding: 12px 16px; background: #2563eb; color: #fff; border-radius: 8px; font-size: 16px; font-weight: 700; margin-top: 6px; }
      .payment-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-top: 8px; }
      .badge-cod { background: #fef3c7; color: #92400e; }
      .badge-paid { background: #dcfce7; color: #166534; }

      .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0; }
      .footer-thanks { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 6px; }
      .footer-detail { font-size: 11px; color: #94a3b8; }
      .footer-social { margin-top: 8px; font-size: 11px; color: #64748b; }

      .tax-row { font-size: 11px; color: #64748b; margin-top: 2px; }

      @media print { body { padding: 20px; } }
    </style></head><body>

    <div class="header">
      <div class="header-left">
        ${company?.logo
          ? `<img src="${company.logo}" alt="Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/><span class="company-name" style="display:none">${company?.name || ''}</span>`
          : `<span class="company-name">${company?.name || 'Company'}</span>`}
        ${company?.tagline ? `<span class="company-detail">${company.tagline}</span>` : ''}
        ${company?.phone ? `<span class="company-detail">📞 ${company.phone}${company?.phone2 ? ` / ${company.phone2}` : ''}</span>` : ''}
        ${company?.email ? `<span class="company-detail">✉️ ${company.email}</span>` : ''}
      </div>
      <div class="invoice-badge">
        <div class="invoice-title">Invoice</div>
        <div class="invoice-num">#${order.order_number}</div>
        <div class="invoice-date">${formatDate(order.order_date)}</div>
        ${company?.tin ? `<div class="tax-row">TIN: ${company.tin}</div>` : ''}
        ${company?.bin ? `<div class="tax-row">BIN: ${company.bin}</div>` : ''}
      </div>
    </div>

    <div class="parties">
      <div class="party-box from">
        <div class="party-label">From</div>
        <div class="party-name">${company?.name || 'Company'}</div>
        ${[company?.address1, company?.address2, company?.city].filter(Boolean).length
          ? `<div class="party-info">${[company?.address1, company?.address2, company?.city].filter(Boolean).join(', ')}</div>` : ''}
      </div>
      <div class="party-box to">
        <div class="party-label">Bill To</div>
        <div class="party-name">${customer?.full_name || '-'}</div>
        ${customer?.phone ? `<div class="party-info">📞 ${customer.phone}</div>` : ''}
        <div class="party-info">${order.delivery_address || customer?.address || '-'}</div>
      </div>
    </div>

    <table>
      <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>${items.map((i: any, idx: number) => `<tr><td>${idx + 1}</td><td style="font-weight:500">${(i.products as any)?.name || '-'}</td><td>${i.quantity}</td><td>৳${Number(i.unit_price).toLocaleString()}</td><td style="font-weight:600">৳${Number(i.total_price).toLocaleString()}</td></tr>`).join('')}</tbody>
    </table>

    <div class="summary">
      <div class="summary-box">
        <div class="summary-row"><span>Subtotal</span><span>৳${Number(subtotal).toLocaleString()}</span></div>
        ${order.discount ? `<div class="summary-row discount"><span>Discount</span><span>-৳${Number(order.discount).toLocaleString()}</span></div>` : ''}
        <div class="summary-row"><span>Delivery Charge</span><span>৳${Number(order.delivery_charge || 0).toLocaleString()}</span></div>
        <div class="summary-divider"></div>
        <div class="summary-total"><span>Total</span><span>৳${Number(order.total_amount || 0).toLocaleString()}</span></div>
        <div style="text-align:right;margin-top:8px">
          <span class="payment-badge ${(order.payment_method || 'COD').toLowerCase() === 'cod' ? 'badge-cod' : 'badge-paid'}">${order.payment_method || 'COD'}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-thanks">Thank you for your order! 🙏</div>
      <div class="footer-detail">If you have questions about this invoice, please contact us.</div>
      ${company?.website || company?.facebook ? `<div class="footer-social">${[company?.website, company?.facebook ? `fb.com: ${company.facebook}` : ''].filter(Boolean).join(' | ')}</div>` : ''}
    </div>

    </body></html>
  `;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.print(); }
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
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
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
    </script>
    </body></html>
  `;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}
