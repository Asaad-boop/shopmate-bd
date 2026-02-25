import { useState } from "react";
import { useSuppliers, useAgents } from "@/hooks/use-purchase-orders";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Users, Eye } from "lucide-react";
import SupplierDetailDrawer from "@/components/suppliers/SupplierDetailDrawer";
import SupplierFormModal from "@/components/suppliers/SupplierFormModal";

export default function SuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const { data: agents } = useAgents();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s: any) => { setEditing(s); setModalOpen(true); };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    await supabase.from("suppliers").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    toast({ title: "Supplier deleted" });
  };

  const filtered = suppliers?.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_person || "").toLowerCase().includes(search.toLowerCase())
  ) || [];

  const countryFlag = (c: string | null) => {
    if (!c) return "🌍";
    const map: Record<string, string> = { China: "🇨🇳", Bangladesh: "🇧🇩", India: "🇮🇳", USA: "🇺🇸", UK: "🇬🇧", Turkey: "🇹🇷" };
    return map[c] || "🌍";
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3 flex items-center justify-between" style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5" /> Suppliers
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
                <TableHead>Country</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(s.id)}>
                  <TableCell>
                    <span className="font-semibold text-sm">{s.name}</span>
                    {s.company_name && <span className="text-xs text-muted-foreground ml-1.5">({s.company_name})</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="mr-1">{countryFlag(s.country)}</span>
                    {s.country || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.contact_person || s.phone || s.wechat_id || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{s.currency || "BDT"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.payment_terms || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "Inactive" ? "outline" : "default"} className="text-xs">
                      {s.status || "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailId(s.id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
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

      {/* Form Modal */}
      <SupplierFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        agents={agents || []}
      />

      {/* Detail Drawer */}
      <SupplierDetailDrawer
        supplierId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(s) => { setDetailId(null); openEdit(s); }}
      />
    </div>
  );
}
