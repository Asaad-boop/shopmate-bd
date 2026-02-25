import { useState } from "react";
import { useSupplierPayments, useSupplierPayables } from "@/hooks/use-purchasing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Wallet, Eye, FileImage } from "lucide-react";
import { format } from "date-fns";
import { PaymentCreateModal } from "./PaymentCreateModal";
import { PaymentDetailDrawer } from "./PaymentDetailDrawer";

export function SupplierPaymentsTab() {
  const { data: payments, isLoading } = useSupplierPayments();
  const { data: payables } = useSupplierPayables();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const filtered = payments?.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.payment_number.toLowerCase().includes(q) ||
      (p.suppliers as any)?.name?.toLowerCase().includes(q) ||
      (p.reference || "").toLowerCase().includes(q)
    );
  }) || [];

  // Stats
  const totalPaid = payments?.filter((p) => p.status === "posted").reduce((s, p) => s + (p.amount || 0), 0) || 0;
  const draftTotal = payments?.filter((p) => p.status === "draft").reduce((s, p) => s + (p.amount || 0), 0) || 0;
  const totalOutstanding = payables?.reduce((s, p) => s + p.outstanding, 0) || 0;

  return (
    <div className="space-y-4 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Paid</p>
          <p className="text-lg font-bold text-foreground">৳{totalPaid.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending Post</p>
          <p className="text-lg font-bold text-amber-600">৳{draftTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Outstanding Due</p>
          <p className="text-lg font-bold text-destructive">৳{totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Payments</p>
          <p className="text-lg font-bold text-foreground">{payments?.length || 0}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Record Payment
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Wallet className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No supplier payments found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Payment #</TableHead>
                <TableHead className="text-xs">Supplier</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="text-xs w-12">Proof</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p, i) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/50 animate-row-in"
                  style={{ animationDelay: `${i * 25}ms` }}
                  onClick={() => setSelectedPaymentId(p.id)}
                >
                  <TableCell className="font-bold text-primary text-sm">{p.payment_number}</TableCell>
                  <TableCell className="text-sm">{(p.suppliers as any)?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{p.payment_method}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(p.chart_of_accounts as any)?.name || "—"}
                  </TableCell>
                  <TableCell className="font-semibold text-right">৳{(p.amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    {(p as any).proof_url && <FileImage className="w-3.5 h-3.5 text-primary inline" />}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] border ${p.status === "posted" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                      {p.status === "posted" ? "✅ Posted" : "📋 Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedPaymentId(p.id); }}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <PaymentCreateModal open={modalOpen} onOpenChange={setModalOpen} />
      <PaymentDetailDrawer paymentId={selectedPaymentId} onClose={() => setSelectedPaymentId(null)} />
    </div>
  );
}
