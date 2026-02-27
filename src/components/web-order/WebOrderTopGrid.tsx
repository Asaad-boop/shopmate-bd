import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MessageCircle, Lock, Globe, Tag, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBDT } from "@/lib/format";

interface Props {
  deliveryForm: any;
  onFormChange: (f: any) => void;
  customerPhone: string;
  grandTotal: number;
  channel: string;
  paymentMethod: string;
}

export function WebOrderTopGrid({ deliveryForm, onFormChange, customerPhone, grandTotal, channel, paymentMethod }: Props) {
  const update = (key: string, value: any) => onFormChange({ ...deliveryForm, [key]: value });

  return (
    <div className="space-y-2">
      {/* Row 1 */}
      <div className="grid grid-cols-4 gap-2">
        {/* Mobile */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Mobile Number</Label>
          <div className="flex gap-1 mt-1">
            <Input
              value={deliveryForm.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="h-8 text-xs font-mono flex-1"
              placeholder="+880"
            />
            <button
              onClick={() => window.open(`tel:${customerPhone}`, "_self")}
              className="w-8 h-8 rounded-md border border-border bg-card flex items-center justify-center hover:bg-accent transition-colors duration-150"
            >
              <Phone className="w-3.5 h-3.5 text-info" />
            </button>
            <button
              onClick={() => window.open(`https://wa.me/88${customerPhone.replace(/^0/, "")}`, "_blank")}
              className="w-8 h-8 rounded-md border border-border bg-card flex items-center justify-center hover:bg-accent transition-colors duration-150"
            >
              <MessageCircle className="w-3.5 h-3.5 text-success" />
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</Label>
          <Input
            value={deliveryForm.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            className="h-8 text-xs mt-1"
            placeholder="Customer name"
          />
        </div>

        {/* Delivery Method */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Delivery Method</Label>
          <Select defaultValue="pathao">
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="pathao" className="text-xs">Pathao</SelectItem>
              <SelectItem value="steadfast" className="text-xs">Steadfast</SelectItem>
              <SelectItem value="redx" className="text-xs">RedX</SelectItem>
              <SelectItem value="sundarban" className="text-xs">Sundarban</SelectItem>
              <SelectItem value="manual" className="text-xs">Manual Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Total preview */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Preview</Label>
          <div className="h-8 mt-1 rounded-md border border-border bg-card flex items-center px-3">
            <span className="text-sm font-bold text-primary tabular-nums">{formatBDT(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-4 gap-2">
        {/* Address */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Address</Label>
          <Textarea
            value={deliveryForm.address}
            onChange={(e) => update("address", e.target.value)}
            className="mt-1 min-h-[52px] max-h-[52px] text-xs resize-none border-2 border-border"
            placeholder="Full delivery address"
            rows={2}
          />
        </div>

        {/* Shipping Note */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Shipping Note
          </Label>
          <Textarea
            value={deliveryForm.note}
            onChange={(e) => update("note", e.target.value)}
            className="mt-1 min-h-[52px] max-h-[52px] text-xs resize-none"
            placeholder="Internal note..."
            rows={2}
          />
        </div>

        {/* Extra Options */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Options</Label>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 cursor-pointer hover:bg-accent transition-colors duration-150">
              <CreditCard className="w-2.5 h-2.5 mr-0.5" /> {paymentMethod || "COD"}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 cursor-pointer hover:bg-accent transition-colors duration-150">
              <Globe className="w-2.5 h-2.5 mr-0.5" /> {channel || "Manual"}
            </Badge>
            <Badge className="text-[9px] px-1.5 py-0.5 bg-info/15 text-info border border-info/20">
              WEB
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 cursor-pointer hover:bg-accent transition-colors duration-150">
              <Tag className="w-2.5 h-2.5 mr-0.5" /> Tag
            </Badge>
          </div>
        </div>

        {/* Preorder / Cross Sale */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Flags</Label>
          <div className="flex flex-col gap-1.5 mt-1.5">
            <div className="flex items-center gap-2">
              <Switch id="preorder" className="scale-75" />
              <label htmlFor="preorder" className="text-[10px] text-muted-foreground cursor-pointer">Pre-order</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="crosssale" className="scale-75" />
              <label htmlFor="crosssale" className="text-[10px] text-muted-foreground cursor-pointer">Cross-sale</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
