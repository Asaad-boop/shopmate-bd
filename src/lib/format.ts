/**
 * Format BDT with Bangladesh-style grouping: ৳1,23,456
 * Bangladesh uses Indian grouping: last 3 digits, then groups of 2
 */
function formatBDTGrouping(num: number): string {
  const isNeg = num < 0;
  const abs = Math.abs(num);
  const str = Math.round(abs).toString();

  if (str.length <= 3) return (isNeg ? "-" : "") + str;

  const last3 = str.slice(-3);
  let rest = str.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);

  return (isNeg ? "-" : "") + groups.join(",") + "," + last3;
}

export function formatBDT(amount: number | null | undefined, decimals: boolean = false): string {
  if (amount == null) return decimals ? '৳0.00' : '৳0';
  if (decimals) {
    const parts = amount.toFixed(2).split(".");
    return `৳${formatBDTGrouping(parseFloat(parts[0]))}.${parts[1]}`;
  }
  return `৳${formatBDTGrouping(amount)}`;
}

/** Format BDT with 2 decimal places — use for courier charges */
export function formatBDT2(amount: number | null | undefined): string {
  return formatBDT(amount, true);
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '0';
  return num.toLocaleString('en-IN');
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const channelConfig: Record<string, { label: string; emoji: string; color: string }> = {
  shopify: { label: 'Shopify', emoji: '🛍️', color: 'bg-emerald-100 text-emerald-800' },
  facebook: { label: 'Facebook', emoji: '📘', color: 'bg-blue-100 text-blue-800' },
  instagram: { label: 'Instagram', emoji: '📸', color: 'bg-pink-100 text-pink-800' },
  whatsapp: { label: 'WhatsApp', emoji: '💬', color: 'bg-green-100 text-green-800' },
  phone: { label: 'Phone', emoji: '📞', color: 'bg-yellow-100 text-yellow-800' },
  manual: { label: 'Manual', emoji: '✍️', color: 'bg-gray-100 text-gray-800' },
};

export const orderStatusConfig: Record<string, { label: string; color: string; emoji: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', emoji: '🕐' },
  packed: { label: 'Packed', color: 'bg-blue-100 text-blue-800', emoji: '📦' },
  ready_to_ship: { label: 'Ready to Ship', color: 'bg-cyan-100 text-cyan-800', emoji: '📋' },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', emoji: '🚚' },
  in_transit: { label: 'In Transit', color: 'bg-purple-100 text-purple-800', emoji: '🛣️' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800', emoji: '✅' },
  delivery_failed: { label: 'Delivery Failed', color: 'bg-red-100 text-red-700', emoji: '⚠️' },
  return_requested: { label: 'Return Requested', color: 'bg-amber-100 text-amber-800', emoji: '📩' },
  return_in_transit: { label: 'Return In Transit', color: 'bg-orange-100 text-orange-700', emoji: '🔙' },
  pending_return: { label: 'Pending Return', color: 'bg-orange-100 text-orange-800', emoji: '🔄' },
  returned: { label: 'Returned', color: 'bg-gray-100 text-gray-800', emoji: '↩️' },
  partially_delivered: { label: 'Partial Delivery', color: 'bg-teal-100 text-teal-800', emoji: '📦½' },
  exchanged: { label: 'Exchanged', color: 'bg-violet-100 text-violet-800', emoji: '🔁' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800', emoji: '🏁' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', emoji: '❌' },
  damage_return: { label: 'Damage Return', color: 'bg-red-200 text-red-900', emoji: '💥' },
};

/** Valid status transitions — strict pipeline rules */
export const validTransitions: Record<string, string[]> = {
  pending:             ['packed', 'cancelled'],
  packed:              ['ready_to_ship', 'pending', 'cancelled'],
  ready_to_ship:       ['shipped', 'packed', 'cancelled'],
  shipped:             ['in_transit', 'delivered', 'delivery_failed'],
  in_transit:          ['delivered', 'delivery_failed'],
  delivered:           ['return_requested', 'partially_delivered', 'completed'],
  delivery_failed:     ['return_in_transit', 'shipped'],
  return_requested:    ['return_in_transit'],
  return_in_transit:   ['returned', 'damage_return'],
  returned:            [],
  partially_delivered: ['completed'],
  exchanged:           [],
  completed:           [],
  cancelled:           [],
  damage_return:       [],
  pending_return:      ['returned', 'damage_return'],
};

/** Action buttons config per status */
export const statusActions: Record<string, { key: string; label: string; icon: string; variant?: string }[]> = {
  pending:           [
    { key: 'packed', label: 'Mark Packed', icon: 'Package' },
    { key: 'cancelled', label: 'Cancel', icon: 'XCircle', variant: 'destructive' },
  ],
  packed:            [
    { key: 'ready_to_ship', label: 'Ready to Ship', icon: 'ClipboardCheck' },
    { key: 'pending', label: 'Back to Pending', icon: 'Undo2' },
    { key: 'cancelled', label: 'Cancel', icon: 'XCircle', variant: 'destructive' },
  ],
  ready_to_ship:     [
    { key: 'shipped', label: 'Send to Courier', icon: 'Send' },
    { key: 'packed', label: 'Back to Packed', icon: 'Undo2' },
    { key: 'cancelled', label: 'Cancel', icon: 'XCircle', variant: 'destructive' },
  ],
  shipped:           [
    { key: 'in_transit', label: 'In Transit', icon: 'Truck' },
    { key: 'delivered', label: 'Mark Delivered', icon: 'CheckCircle' },
    { key: 'delivery_failed', label: 'Delivery Failed', icon: 'AlertTriangle' },
  ],
  in_transit:        [
    { key: 'delivered', label: 'Mark Delivered', icon: 'CheckCircle' },
    { key: 'delivery_failed', label: 'Delivery Failed', icon: 'AlertTriangle' },
  ],
  delivered:         [
    { key: 'return_requested', label: 'Return Request', icon: 'RotateCcw' },
    { key: 'completed', label: 'Mark Completed', icon: 'Flag' },
  ],
  delivery_failed:   [
    { key: 'return_in_transit', label: 'Return In Transit', icon: 'RotateCcw' },
    { key: 'shipped', label: 'Re-Ship', icon: 'Send' },
  ],
  return_requested:  [
    { key: 'return_in_transit', label: 'Start Return', icon: 'Truck' },
  ],
  return_in_transit: [
    { key: 'returned', label: 'Mark Returned', icon: 'PackageCheck' },
    { key: 'damage_return', label: 'Damage Return', icon: 'AlertOctagon' },
  ],
  pending_return:    [
    { key: 'returned', label: 'Mark Returned', icon: 'PackageCheck' },
    { key: 'damage_return', label: 'Damage Return', icon: 'AlertOctagon' },
  ],
};

export const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-800' },
  refunded: { label: 'Refunded', color: 'bg-red-100 text-red-800' },
};
