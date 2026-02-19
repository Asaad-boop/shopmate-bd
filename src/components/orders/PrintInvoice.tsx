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

  const html = `
    <html><head><title>Invoice - ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #000; max-width: 800px; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
      th { background: #f5f5f5; }
      .totals { text-align: right; margin-top: 10px; }
      .totals p { margin: 3px 0; font-size: 14px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
      .invoice-meta { font-size: 12px; color: #666; margin-bottom: 15px; }
      @media print { body { padding: 15px; } }
    </style></head><body>
    ${companyHeader(company)}
    <div class="invoice-meta">
      <strong>INVOICE</strong> #${order.order_number}<br>
      Date: ${formatDate(order.order_date)}
      ${company?.tin ? `<br>TIN: ${company.tin}` : ''}
      ${company?.bin ? `<br>BIN: ${company.bin}` : ''}
    </div>
    <p style="font-size:13px;background:#f9f9f9;padding:8px;border-radius:4px"><strong>Bill To:</strong><br>${customer?.full_name || '-'}<br>${customer?.phone || ''}<br>${order.delivery_address || customer?.address || ''}</p>
    <table>
      <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>${items.map((i: any, idx: number) => `<tr><td>${idx + 1}</td><td>${(i.products as any)?.name || '-'}</td><td>${i.quantity}</td><td>৳${i.unit_price}</td><td>৳${i.total_price}</td></tr>`).join('')}</tbody>
    </table>
    <div class="totals">
      <p>Subtotal: ৳${order.subtotal || 0}</p>
      ${order.discount ? `<p>Discount: -৳${order.discount}</p>` : ''}
      <p>Delivery: ৳${order.delivery_charge || 0}</p>
      <p style="font-size:16px"><strong>Total: ৳${order.total_amount || 0}</strong></p>
      <p>Payment: ${order.payment_method || 'COD'}</p>
    </div>
    <div class="footer">
      <p>Thank you for your order! 🙏</p>
      ${company?.website ? `<p>${company.website}</p>` : ''}
      ${company?.facebook ? `<p>Facebook: ${company.facebook}</p>` : ''}
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
