import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ShieldAlert, Ban, Phone, AlertTriangle, Search, TrendingDown, XCircle,
  Users, MapPin, RefreshCw,
} from "lucide-react";
import { formatBDT } from "@/lib/format";

interface FraudPhone {
  phone: string;
  full_name: string;
  total_orders: number;
  cancelled: number;
  returned: number;
  cancel_rate: number;
  return_rate: number;
  risk_score: number;
  is_blocked: boolean;
  customer_id: string;
}

export default function FakeOrderReports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("repeat");
  const [search, setSearch] = useState("");
  const [blockDialog, setBlockDialog] = useState<FraudPhone | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [thresholdCancel, setThresholdCancel] = useState(40);
  const [thresholdReturn, setThresholdReturn] = useState(40);

  // Fetch all customers with order stats
  const { data: fraudData, isLoading } = useQuery({
    queryKey: ["fake-order-report"],
    queryFn: async () => {
      // Get all customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id, full_name, phone, total_orders, total_spent, is_blocked, address, district")
        .order("total_orders", { ascending: false });

      if (!customers) return { phones: [], addresses: [] };

      // Get order statuses per customer
      const PAGE_SIZE = 1000;
      let allOrders: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase.from("orders")
          .select("customer_id, status")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        allOrders = [...allOrders, ...(data || [])];
        hasMore = (data || []).length === PAGE_SIZE;
        page++;
      }

      const statsMap = new Map<string, { delivered: number; returned: number; cancelled: number; total: number }>();
      allOrders.forEach((o) => {
        if (!o.customer_id) return;
        if (!statsMap.has(o.customer_id)) statsMap.set(o.customer_id, { delivered: 0, returned: 0, cancelled: 0, total: 0 });
        const s = statsMap.get(o.customer_id)!;
        s.total++;
        if (o.status === "delivered" || o.status === "completed") s.delivered++;
        else if (o.status === "returned") s.returned++;
        else if (o.status === "cancelled") s.cancelled++;
      });

      const phones: FraudPhone[] = customers
        .filter((c) => (c.total_orders || 0) >= 2)
        .map((c) => {
          const os = statsMap.get(c.id) || { delivered: 0, returned: 0, cancelled: 0, total: 0 };
          const total = os.total || (c.total_orders || 0);
          const cancelRate = total > 0 ? Math.round((os.cancelled / total) * 100) : 0;
          const returnRate = total > 0 ? Math.round((os.returned / total) * 100) : 0;
          const riskScore = (cancelRate >= 50 ? 40 : cancelRate >= 30 ? 20 : 0) +
            (returnRate >= 50 ? 40 : returnRate >= 30 ? 20 : 0) +
            (c.is_blocked ? 20 : 0);
          return {
            phone: c.phone,
            full_name: c.full_name,
            total_orders: total,
            cancelled: os.cancelled,
            returned: os.returned,
            cancel_rate: cancelRate,
            return_rate: returnRate,
            risk_score: riskScore,
            is_blocked: c.is_blocked || false,
            customer_id: c.id,
          };
        })
        .sort((a, b) => b.risk_score - a.risk_score);

      // Address patterns — group by district
      const districtMap = new Map<string, { count: number; cancelled: number; returned: number; total: number }>();
      customers.forEach((c) => {
        const district = c.district || "Unknown";
        if (!districtMap.has(district)) districtMap.set(district, { count: 0, cancelled: 0, returned: 0, total: 0 });
        const d = districtMap.get(district)!;
        d.count++;
        const os = statsMap.get(c.id);
        if (os) {
          d.cancelled += os.cancelled;
          d.returned += os.returned;
          d.total += os.total;
        }
      });

      const addresses = Array.from(districtMap.entries())
        .map(([district, s]) => ({
          district,
          customers: s.count,
          cancelled: s.cancelled,
          returned: s.returned,
          total: s.total,
          cancel_rate: s.total > 0 ? Math.round((s.cancelled / s.total) * 100) : 0,
          return_rate: s.total > 0 ? Math.round((s.returned / s.total) * 100) : 0,
        }))
        .filter((a) => a.total >= 5)
        .sort((a, b) => b.cancel_rate - a.cancel_rate);

      return { phones, addresses };
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, is_blocked, reason }: { id: string; is_blocked: boolean; reason: string }) => {
      const { error } = await supabase.from("customers").update({
        is_blocked,
        blocked_at: is_blocked ? new Date().toISOString() : null,
        blocked_reason: is_blocked ? reason : null,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["fake-order-report"] });
      toast({ title: vars.is_blocked ? "🚫 Phone blocked" : "✅ Phone unblocked" });
      setBlockDialog(null);
      setBlockReason("");
    },
  });

  const phones = fraudData?.phones || [];
  const addresses = fraudData?.addresses || [];

  const repeatPhones = useMemo(() => phones.filter((p) => p.total_orders >= 3), [phones]);
  const highCancelPhones = useMemo(() => phones.filter((p) => p.cancel_rate >= thresholdCancel), [phones, thresholdCancel]);
  const highReturnPhones = useMemo(() => phones.filter((p) => p.return_rate >= thresholdReturn), [phones, thresholdReturn]);
  const suspiciousAddresses = useMemo(() => addresses.filter((a) => a.cancel_rate >= 30 || a.return_rate >= 30), [addresses]);
  const blockedCount = phones.filter((p) => p.is_blocked).length;

  const filtered = (list: FraudPhone[]) => {
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((p) => p.phone.includes(s) || p.full_name.toLowerCase().includes(s));
  };

  const RiskBadge = ({ score }: { score: number }) => (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
      score >= 60 ? "bg-red-100 text-red-700" : score >= 30 ? "bg-amber-100 text-amber-700" : "bg-yellow-50 text-yellow-700"
    )}>
      <AlertTriangle className="w-3 h-3" />
      {score >= 60 ? "HIGH" : score >= 30 ? "MED" : "LOW"}
    </span>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" /> Fake Order Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Detect fraud patterns, block risky customers</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => queryClient.invalidateQueries({ queryKey: ["fake-order-report"] })}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard title="High Cancel Rate" value={String(highCancelPhones.length)} icon={<XCircle className="w-5 h-5" />} loading={isLoading} subtitle={`≥${thresholdCancel}% cancel rate`} />
        <KpiCard title="High Return Rate" value={String(highReturnPhones.length)} icon={<TrendingDown className="w-5 h-5" />} loading={isLoading} subtitle={`≥${thresholdReturn}% return rate`} />
        <KpiCard title="Repeat Offenders" value={String(repeatPhones.filter((p) => p.risk_score >= 30).length)} icon={<Users className="w-5 h-5" />} loading={isLoading} subtitle="3+ orders, medium+ risk" />
        <KpiCard title="Suspicious Areas" value={String(suspiciousAddresses.length)} icon={<MapPin className="w-5 h-5" />} loading={isLoading} subtitle="≥30% cancel/return" />
        <KpiCard title="Blocked Phones" value={String(blockedCount)} icon={<Ban className="w-5 h-5" />} loading={isLoading} subtitle="Currently blocked" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="repeat">📋 Repeat Numbers</TabsTrigger>
            <TabsTrigger value="cancel">❌ High Cancel</TabsTrigger>
            <TabsTrigger value="return">↩️ High Return</TabsTrigger>
            <TabsTrigger value="address">📍 Address Patterns</TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search phone or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>

        {/* Repeat Numbers */}
        <TabsContent value="repeat">
          <Card>
            <CardContent className="p-0">
              <PhoneTable
                data={filtered(repeatPhones)}
                loading={isLoading}
                onBlock={(p) => p.is_blocked ? blockMutation.mutate({ id: p.customer_id, is_blocked: false, reason: "" }) : setBlockDialog(p)}
                RiskBadge={RiskBadge}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* High Cancel */}
        <TabsContent value="cancel">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm">High Cancel Rate Customers</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Threshold:</span>
                <Input type="number" value={thresholdCancel} onChange={(e) => setThresholdCancel(Number(e.target.value))} className="w-16 h-7 text-xs" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <PhoneTable
                data={filtered(highCancelPhones)}
                loading={isLoading}
                onBlock={(p) => p.is_blocked ? blockMutation.mutate({ id: p.customer_id, is_blocked: false, reason: "" }) : setBlockDialog(p)}
                RiskBadge={RiskBadge}
                highlightColumn="cancel"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* High Return */}
        <TabsContent value="return">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm">High Return Rate Customers</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Threshold:</span>
                <Input type="number" value={thresholdReturn} onChange={(e) => setThresholdReturn(Number(e.target.value))} className="w-16 h-7 text-xs" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <PhoneTable
                data={filtered(highReturnPhones)}
                loading={isLoading}
                onBlock={(p) => p.is_blocked ? blockMutation.mutate({ id: p.customer_id, is_blocked: false, reason: "" }) : setBlockDialog(p)}
                RiskBadge={RiskBadge}
                highlightColumn="return"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address Patterns */}
        <TabsContent value="address">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>District</TableHead>
                    <TableHead>Customers</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Cancelled</TableHead>
                    <TableHead>Cancel Rate</TableHead>
                    <TableHead>Returned</TableHead>
                    <TableHead>Return Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : suspiciousAddresses.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No suspicious address patterns found</TableCell></TableRow>
                  ) : (
                    suspiciousAddresses.map((a) => (
                      <TableRow key={a.district}>
                        <TableCell className="font-medium">{a.district}</TableCell>
                        <TableCell>{a.customers}</TableCell>
                        <TableCell>{a.total}</TableCell>
                        <TableCell className="text-red-600 font-medium">{a.cancelled}</TableCell>
                        <TableCell>
                          <span className={cn("text-xs font-bold", a.cancel_rate >= 40 ? "text-red-600" : a.cancel_rate >= 20 ? "text-amber-600" : "text-muted-foreground")}>
                            {a.cancel_rate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-orange-600 font-medium">{a.returned}</TableCell>
                        <TableCell>
                          <span className={cn("text-xs font-bold", a.return_rate >= 40 ? "text-red-600" : a.return_rate >= 20 ? "text-amber-600" : "text-muted-foreground")}>
                            {a.return_rate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Block Dialog */}
      <Dialog open={!!blockDialog} onOpenChange={(v) => !v && setBlockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" /> Block Customer
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Block <strong>{blockDialog?.full_name}</strong> ({blockDialog?.phone})?
            This prevents web order confirmation.
          </p>
          <Textarea placeholder="Reason for blocking..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={!blockReason}
              onClick={() => blockDialog && blockMutation.mutate({ id: blockDialog.customer_id, is_blocked: true, reason: blockReason })}>
              🚫 Block Phone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Phone Table Component ─── */
function PhoneTable({ data, loading, onBlock, RiskBadge, highlightColumn }: {
  data: FraudPhone[];
  loading: boolean;
  onBlock: (p: FraudPhone) => void;
  RiskBadge: React.FC<{ score: number }>;
  highlightColumn?: "cancel" | "return";
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Orders</TableHead>
          <TableHead>Cancelled</TableHead>
          <TableHead>Cancel %</TableHead>
          <TableHead>Returned</TableHead>
          <TableHead>Return %</TableHead>
          <TableHead>Risk</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>{Array.from({ length: 10 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
          ))
        ) : data.length === 0 ? (
          <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No suspicious customers found</TableCell></TableRow>
        ) : (
          data.map((p) => (
            <TableRow key={p.phone} className={cn(p.is_blocked && "bg-red-50/30 opacity-70")}>
              <TableCell className="font-medium text-sm">{p.full_name}</TableCell>
              <TableCell className="font-mono text-sm">{p.phone}</TableCell>
              <TableCell>{p.total_orders}</TableCell>
              <TableCell className={cn(highlightColumn === "cancel" && "font-bold text-red-600")}>{p.cancelled}</TableCell>
              <TableCell>
                <span className={cn("text-xs font-bold", p.cancel_rate >= 50 ? "text-red-600" : p.cancel_rate >= 30 ? "text-amber-600" : "text-muted-foreground")}>
                  {p.cancel_rate}%
                </span>
              </TableCell>
              <TableCell className={cn(highlightColumn === "return" && "font-bold text-orange-600")}>{p.returned}</TableCell>
              <TableCell>
                <span className={cn("text-xs font-bold", p.return_rate >= 50 ? "text-red-600" : p.return_rate >= 30 ? "text-amber-600" : "text-muted-foreground")}>
                  {p.return_rate}%
                </span>
              </TableCell>
              <TableCell><RiskBadge score={p.risk_score} /></TableCell>
              <TableCell>
                {p.is_blocked ? (
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">🚫 Blocked</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant={p.is_blocked ? "outline" : "destructive"} className="text-xs h-7" onClick={() => onBlock(p)}>
                  {p.is_blocked ? "Unblock" : "🚫 Block"}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}