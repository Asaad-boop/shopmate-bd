import { formatBDT, formatDate } from "@/lib/format";

interface PrintInvoiceProps {
  orders: any[];
  type: "invoice" | "picking" | "packing" | "barcode";
}

export function printInvoice(order: any) {
  const items = order.order_items || [];
  const customer = order.customers;

  const html = `
    <html><head><title>Invoice - ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #000; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 20px; margin-bottom: 5px; }
      .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
      th { background: #f5f5f5; }
      .totals { text-align: right; margin-top: 10px; }
      .totals p { margin: 3px 0; font-size: 14px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
      @media print { body { padding: 15px; } }
    </style></head><body>
    <div class="header">
      <div><h1>INVOICE</h1><p style="font-size:12px;color:#666">Invoice #: ${order.order_number}<br>Date: ${formatDate(order.order_date)}</p></div>
    </div>
    <p style="font-size:13px"><strong>${customer?.full_name || '-'}</strong><br>${customer?.phone || ''}<br>${order.delivery_address || customer?.address || ''}</p>
    <table>
      <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>${items.map((i: any) => `<tr><td>${(i.products as any)?.name || '-'}</td><td>${i.quantity}</td><td>৳${i.unit_price}</td><td>৳${i.total_price}</td></tr>`).join('')}</tbody>
    </table>
    <div class="totals">
      <p>Subtotal: ৳${order.subtotal || 0}</p>
      <p>Discount: -৳${order.discount || 0}</p>
      <p>Delivery: ৳${order.delivery_charge || 0}</p>
      <p><strong>Total: ৳${order.total_amount || 0}</strong></p>
      <p>Payment: ${order.payment_method || 'COD'}</p>
    </div>
    <div class="footer"><p>Thank you for your order!</p></div>
    </body></html>
  `;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export function printPickingList(orders: any[]) {
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
      h1 { font-size: 18px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 6px 10px; font-size: 14px; }
      th { background: #eee; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <h1>📋 Picking List — ${new Date().toLocaleDateString()}</h1>
    <p>Total Orders: ${orders.length} | Total Items: ${allItems.length}</p>
    <table>
      <thead><tr><th>Order #</th><th>Customer</th><th>SKU</th><th>Product</th><th>Qty</th><th>☐</th></tr></thead>
      <tbody>${allItems.map((i) => `<tr><td>${i.orderNumber}</td><td>${i.customer}</td><td>${i.sku}</td><td>${i.name}</td><td>${i.qty}</td><td></td></tr>`).join('')}</tbody>
    </table>
    </body></html>
  `;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export function printPackingSlip(order: any) {
  const items = order.order_items || [];
  const html = `
    <html><head><title>Packing Slip - ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; max-width: 500px; }
      h1 { font-size: 24px; text-align: center; margin-bottom: 15px; }
      p { font-size: 13px; margin: 3px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 13px; }
      @page { size: A5; }
    </style></head><body>
    <h1>${order.order_number}</h1>
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

export function printBarcodeLabels(orders: any[]) {
  const labels = orders.map((o) => ({
    orderNumber: o.order_number,
    customer: (o.customers as any)?.full_name || '-',
    phone: (o.customers as any)?.phone || '-',
    address: o.delivery_address || (o.customers as any)?.address || '',
    cod: o.payment_method?.toLowerCase() === 'cod' ? o.total_amount : 0,
  }));

  const html = `
    <html><head><title>Barcode Labels</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
    <style>
      body { font-family: Arial, sans-serif; padding: 10px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .label { border: 1px solid #000; padding: 10px; page-break-inside: avoid; }
      .label p { margin: 2px 0; font-size: 11px; }
      .label .order-num { font-size: 14px; font-weight: bold; }
      svg { max-width: 100%; height: 40px; }
      @media print { .grid { gap: 5px; } }
    </style></head><body>
    <div class="grid">
      ${labels.map((l, i) => `
        <div class="label">
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
