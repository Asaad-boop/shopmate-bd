import { useState } from "react";
import { useAgents } from "@/hooks/use-purchase-orders";
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
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";

export default function AgentsPage() {
  const { data: agents, isLoading } = useAgents();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [form, setForm] = useState({
    name: "", contact_person: "", profile_image_url: "",
    phone: "", whatsapp: "", bkash_number: "",
    nagad_number: "", bank_account: "", bank_name: "",
    notes: "", rating: 5,
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", contact_person: "", profile_image_url: "", phone: "", whatsapp: "", bkash_number: "", nagad_number: "", bank_account: "", bank_name: "", notes: "", rating: 5 });
    setModalOpen(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      name: a.name, contact_person: a.contact_person || "", profile_image_url: a.profile_image_url || "",
      phone: a.phone || "", whatsapp: a.whatsapp || "",
      bkash_number: a.bkash_number || "", nagad_number: a.nagad_number || "",
      bank_account: a.bank_account || "", bank_name: a.bank_name || "",
      notes: a.notes || "", rating: a.rating || 5,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    try {
      if (editing) {
        await supabase.from("agents").update(form).eq("id", editing.id);
      } else {
        await supabase.from("agents").insert(form);
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast({ title: editing ? "Agent updated!" : "Agent added!" });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent?")) return;
    await supabase.from("agents").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["agents"] });
    toast({ title: "Agent deleted" });
  };

  const filtered = agents?.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3 flex items-center justify-between" style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🤝 Agents</h1>
          <Badge variant="secondary" className="text-xs font-semibold">{agents?.length ?? 0}</Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="w-4 h-4" /> Add Agent
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Users className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No agents found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>bKash</TableHead>
                <TableHead>Total POs</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {a.profile_image_url ? (
                        <img src={a.profile_image_url} alt={a.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {a.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="font-semibold text-sm">{a.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.contact_person || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.phone || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.whatsapp || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.bkash_number || "—"}</TableCell>
                  <TableCell className="text-sm">{a.total_orders || 0}</TableCell>
                  <TableCell className="text-sm font-medium">৳{(a.total_amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className="text-warning">{"★".repeat(a.rating || 0)}{"☆".repeat(5 - (a.rating || 0))}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a.id)}>
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Agent" : "Add Agent"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-4 mb-2">
              <div className="relative group">
                {form.profile_image_url ? (
                  <img src={form.profile_image_url} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
                    {form.name ? form.name[0].toUpperCase() : <Users className="w-6 h-6" />}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input placeholder="Agent Name *" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Contact Person Name" value={form.contact_person} onChange={(e) => setForm(p => ({ ...p, contact_person: e.target.value }))} />
              </div>
            </div>
            <Input placeholder="Profile Image URL" value={form.profile_image_url} onChange={(e) => setForm(p => ({ ...p, profile_image_url: e.target.value }))} className="text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
              <Input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm(p => ({ ...p, whatsapp: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="bKash Number" value={form.bkash_number} onChange={(e) => setForm(p => ({ ...p, bkash_number: e.target.value }))} />
              <Input placeholder="Nagad Number" value={form.nagad_number} onChange={(e) => setForm(p => ({ ...p, nagad_number: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Bank Account" value={form.bank_account} onChange={(e) => setForm(p => ({ ...p, bank_account: e.target.value }))} />
              <Input placeholder="Bank Name" value={form.bank_name} onChange={(e) => setForm(p => ({ ...p, bank_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(r => (
                  <button key={r} onClick={() => setForm(p => ({ ...p, rating: r }))} className={`text-lg ${r <= form.rating ? "text-warning" : "text-muted-foreground/30"}`}>★</button>
                ))}
              </div>
            </div>
            <Textarea placeholder="Notes..." value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Update" : "Add Agent"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
