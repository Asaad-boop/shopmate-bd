import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const emptyForm = {
  name: "", country: "China", contact_person: "", wechat_id: "", whatsapp: "",
  phone: "", email: "", rating: 5, notes: "", company_name: "",
  alipay_id: "", bank_account_name: "", bank_account_number: "",
  bank_name: "", swift_code: "", usdt_wallet: "", usdt_network: "TRC20",
  preferred_payment: "alipay", currency: "CNY", payment_terms: "Advance",
  status: "Active", agent_id: "",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any;
  agents: any[];
}

export default function SupplierFormModal({ open, onOpenChange, editing, agents }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || "", country: editing.country || "China",
        contact_person: editing.contact_person || "", wechat_id: editing.wechat_id || "",
        whatsapp: editing.whatsapp || "", phone: editing.phone || "",
        email: editing.email || "", rating: editing.rating || 5,
        notes: editing.notes || "", company_name: editing.company_name || "",
        alipay_id: editing.alipay_id || "", bank_account_name: editing.bank_account_name || "",
        bank_account_number: editing.bank_account_number || "",
        bank_name: editing.bank_name || "", swift_code: editing.swift_code || "",
        usdt_wallet: editing.usdt_wallet || "", usdt_network: editing.usdt_network || "TRC20",
        preferred_payment: editing.preferred_payment || "alipay",
        currency: editing.currency || "CNY", payment_terms: editing.payment_terms || "Advance",
        status: editing.status || "Active", agent_id: editing.agent_id || "",
      });
    } else {
      setForm({ ...emptyForm });
    }
  }, [editing, open]);

  const handleSave = async () => {
    if (!form.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const payload: any = { ...form, agent_id: form.agent_id || null };
    try {
      if (editing) {
        await supabase.from("suppliers").update(payload).eq("id", editing.id);
      } else {
        await supabase.from("suppliers").insert(payload);
      }
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: editing ? "Supplier updated!" : "Supplier added!" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="basic">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">Basic Info</TabsTrigger>
            <TabsTrigger value="payment" className="flex-1">Payment Methods</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="space-y-3 mt-3">
            <Input placeholder="Supplier Name *" value={form.name} onChange={e => set("name", e.target.value)} />
            <Input placeholder="Company Name" value={form.company_name} onChange={e => set("company_name", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.country} onValueChange={v => set("country", v)}>
                <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                <SelectContent>
                  {["China", "Bangladesh", "India", "Turkey", "USA", "UK", "Other"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Contact Person" value={form.contact_person} onChange={e => set("contact_person", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="WeChat ID" value={form.wechat_id} onChange={e => set("wechat_id", e.target.value)} />
              <Input placeholder="WhatsApp" value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} />
              <Input placeholder="Email" value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.currency} onValueChange={v => set("currency", v)}>
                <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                <SelectContent>
                  {["BDT", "CNY", "USD", "EUR", "GBP", "INR", "TRY"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.payment_terms} onValueChange={v => set("payment_terms", v)}>
                <SelectTrigger><SelectValue placeholder="Payment Terms" /></SelectTrigger>
                <SelectContent>
                  {["Advance", "50/50", "Net 15", "Net 30", "Net 60", "On Delivery", "Custom"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={form.agent_id || "_none"} onValueChange={v => set("agent_id", v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Agent (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No Agent</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(r => (
                  <button key={r} onClick={() => set("rating", r)} className={`text-lg ${r <= form.rating ? "text-yellow-500" : "text-muted-foreground/30"}`}>★</button>
                ))}
              </div>
            </div>
            <Textarea placeholder="Notes..." value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} />
          </TabsContent>
          <TabsContent value="payment" className="space-y-3 mt-3">
            <Input placeholder="Alipay ID" value={form.alipay_id} onChange={e => set("alipay_id", e.target.value)} />
            <Separator className="my-2" />
            <p className="text-xs font-bold text-muted-foreground">Bank Details</p>
            <Input placeholder="Account Name" value={form.bank_account_name} onChange={e => set("bank_account_name", e.target.value)} />
            <Input placeholder="Account Number" value={form.bank_account_number} onChange={e => set("bank_account_number", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Bank Name" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} />
              <Input placeholder="SWIFT Code" value={form.swift_code} onChange={e => set("swift_code", e.target.value)} />
            </div>
            <Separator className="my-2" />
            <p className="text-xs font-bold text-muted-foreground">USDT</p>
            <Input placeholder="Wallet Address" value={form.usdt_wallet} onChange={e => set("usdt_wallet", e.target.value)} />
            <Select value={form.usdt_network} onValueChange={v => set("usdt_network", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TRC20">TRC20</SelectItem>
                <SelectItem value="ERC20">ERC20</SelectItem>
              </SelectContent>
            </Select>
            <Separator className="my-2" />
            <Select value={form.preferred_payment} onValueChange={v => set("preferred_payment", v)}>
              <SelectTrigger><SelectValue placeholder="Preferred Method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alipay">Alipay</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="usdt">USDT</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>{editing ? "Update" : "Add Supplier"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
