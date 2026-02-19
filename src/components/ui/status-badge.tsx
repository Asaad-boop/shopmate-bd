import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  config: Record<string, { label: string; color: string }>;
  status: string | null | undefined;
}

export function StatusBadge({ config, status }: StatusBadgeProps) {
  const s = status?.toLowerCase() || 'pending';
  const cfg = config[s] || { label: s, color: 'bg-gray-100 text-gray-800' };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
      {cfg.label}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string | null | undefined }) {
  const configs: Record<string, { label: string; emoji: string; color: string }> = {
    shopify: { label: 'Shopify', emoji: '🛍️', color: 'bg-emerald-100 text-emerald-800' },
    facebook: { label: 'Facebook', emoji: '📘', color: 'bg-blue-100 text-blue-800' },
    instagram: { label: 'Instagram', emoji: '📸', color: 'bg-pink-100 text-pink-800' },
    whatsapp: { label: 'WhatsApp', emoji: '💬', color: 'bg-green-100 text-green-800' },
    phone: { label: 'Phone', emoji: '📞', color: 'bg-yellow-100 text-yellow-800' },
    manual: { label: 'Manual', emoji: '✍️', color: 'bg-gray-100 text-gray-800' },
  };
  const ch = channel?.toLowerCase() || 'manual';
  const cfg = configs[ch] || configs.manual;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
      <span>{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </span>
  );
}
