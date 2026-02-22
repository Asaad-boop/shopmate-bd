import { useState } from "react";
import { useSuppliers } from "@/hooks/use-purchase-orders";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Star, Users } from "lucide-react";

export default function SuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", country: "China", contact_person: "", wechat_id: "", whatsapp: "",
    phone: "", email: "", rating: 5, notes: "",
    alipay_id: "", bank_account_name: "", bank_account_number: "",
    bank_name: "", swift_code: "", usdt_wallet: "", usdt_network: "TRC20",
    preferred_payment: "alipay",
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "", country: "China", contact_person: "", wechat_id: "", whatsapp: "",
      phone: "", email: "", rating: 5, notes: "",
      alipay_id: "", bank_account_name: "", bank_account_number: "",
      bank_name: "", swift_code: "", usdt_wallet: "", usdt_network: "TRC20",
      preferred_payment: "alipay",
    });
    setModalOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name, country: s.country || "China", contact_person: s.contact_person || "",
      wechat_id: s.wechat_id || "", whatsapp: s.whatsapp || "",
      phone: s.phone || "", email: s.email || "", rating: s.rating || 5, notes: s.notes || "",
      alipay_id: (s as any).alipay_id || "", bank_account_name: (s as any).bank_account_name || "",
      bank_account_number: (s as any).bank_account_number || "",
      bank_name: (s as any).bank_name || "", swift_code: (s as any).swift_code || "",
      usdt_wallet: (s as any).usdt_wallet || "", usdt_network: (s as any).usdt_network || "TRC20",
      preferred_payment: (s as any).preferred_payment || "alipay",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    try {
      if (editing) {
        await supabase.from("suppliers").update(form as any).eq("id", editing.id);
      } else {
        await supabase.from("suppliers").insert(form as any);
      }
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: editing ? "Supplier updated!" : "Supplier added!" });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    await supabase.from("suppliers").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    toast({ title: "Supplier deleted" });
  };

  const filtered = suppliers?.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3 flex items-center justify-between" style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            🇨🇳 Suppliers
          </h1>
          <Badge variant="secondary" className="text-xs font-semibold">{suppliers?.length ?? 0}</Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="w-4 h-4" /> Add Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Users className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No suppliers found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>WeChat</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Total POs</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>🇨🇳</span>
                      <span className="font-semibold text-sm">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.wechat_id || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.whatsapp || "—"}</TableCell>
                  <TableCell className="text-sm">{s.total_orders || 0}</TableCell>
                  <TableCell className="text-sm font-medium">৳{(s.total_amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className="text-warning">{"★".repeat(s.rating || 0)}{"☆".repeat(5 - (s.rating || 0))}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic">
            <TabsList className="w-full">
              <TabsTrigger value="basic" className="flex-1">Basic Info</TabsTrigger>
              <TabsTrigger value="payment" className="flex-1">Payment Methods</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-3 mt-3">
              <Input placeholder="Supplier Name *" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Contact Person" value={form.contact_person} onChange={(e) => setForm(p => ({ ...p, contact_person: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="WeChat ID" value={form.wechat_id} onChange={(e) => setForm(p => ({ ...p, wechat_id: e.target.value }))} />
                <Input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm(p => ({ ...p, whatsapp: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
                <Input placeholder="Email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button key={r} onClick={() => setForm(p => ({ ...p, rating: r }))} className={`text-lg ${r <= form.rating ? "text-warning" : "text-muted-foreground/30"}`}>
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <Textarea placeholder="Notes..." value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
            </TabsContent>
            <TabsContent value="payment" className="space-y-3 mt-3">
              <Input placeholder="Alipay ID" value={form.alipay_id} onChange={(e) => setForm(p => ({ ...p, alipay_id: e.target.value }))} />
              <Separator className="my-2" />
              <p className="text-xs font-bold text-muted-foreground">Bank Details</p>
              <Input placeholder="Account Name" value={form.bank_account_name} onChange={(e) => setForm(p => ({ ...p, bank_account_name: e.target.value }))} />
              <Input placeholder="Account Number" value={form.bank_account_number} onChange={(e) => setForm(p => ({ ...p, bank_account_number: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Bank Name" value={form.bank_name} onChange={(e) => setForm(p => ({ ...p, bank_name: e.target.value }))} />
                <Input placeholder="SWIFT Code" value={form.swift_code} onChange={(e) => setForm(p => ({ ...p, swift_code: e.target.value }))} />
              </div>
              <Separator className="my-2" />
              <p className="text-xs font-bold text-muted-foreground">USDT</p>
              <Input placeholder="Wallet Address" value={form.usdt_wallet} onChange={(e) => setForm(p => ({ ...p, usdt_wallet: e.target.value }))} />
              <Select value={form.usdt_network} onValueChange={(v) => setForm(p => ({ ...p, usdt_network: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRC20">TRC20</SelectItem>
                  <SelectItem value="ERC20">ERC20</SelectItem>
                </SelectContent>
              </Select>
              <Separator className="my-2" />
              <Select value={form.preferred_payment} onValueChange={(v) => setForm(p => ({ ...p, preferred_payment: v }))}>
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
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Update" : "Add Supplier"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
