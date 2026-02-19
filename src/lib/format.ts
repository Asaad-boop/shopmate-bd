export function formatBDT(amount: number | null | undefined): string {
  if (amount == null) return '৳0';
  return `৳${amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '0';
  return num.toLocaleString();
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
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', emoji: '🚚' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800', emoji: '✅' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', emoji: '❌' },
  pending_return: { label: 'Pending Return', color: 'bg-orange-100 text-orange-800', emoji: '🔄' },
  returned: { label: 'Returned', color: 'bg-gray-100 text-gray-800', emoji: '↩️' },
  damage_return: { label: 'Damage Return', color: 'bg-red-200 text-red-900', emoji: '💥' },
};

export const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-800' },
  refunded: { label: 'Refunded', color: 'bg-red-100 text-red-800' },
};
