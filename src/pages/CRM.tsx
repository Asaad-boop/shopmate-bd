import { useState, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Phone, MessageCircle, Clock, Plus, CalendarIcon, Search, Check,
  TrendingUp, Crown, Download, X, Diamond, Star, RefreshCw, Target,
  UserPlus, Zap, Skull, Moon, Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  useCustomers, useFollowups, useLeads, useCRMMutations,
  CRMCustomer, Lead,
} from "@/hooks/use-crm";
import { CustomerProfileDrawer } from "@/components/crm/CustomerProfileDrawer";
import { CustomerImportModal } from "@/components/crm/CustomerImportModal";

/* ─── Segment Config ─── */
const SEGMENT_CONFIG: Record<string, { label: string; color: string; textColor: string; borderColor: string; emoji: string }> = {
  diamond: { label: "Diamond", color: "bg-purple-50 text-purple-700", textColor: "text-purple-700", borderColor: "border-purple-200", emoji: "💎" },
  gold: { label: "Gold", color: "bg-amber-50 text-amber-700", textColor: "text-amber-700", borderColor: "border-amber-200", emoji: "👑" },
  silver: { label: "Silver", color: "bg-slate-100 text-slate-600", textColor: "text-slate-600", borderColor: "border-slate-300", emoji: "⭐" },
  new: { label: "New", color: "bg-emerald-50 text-emerald-700", textColor: "text-emerald-700", borderColor: "border-emerald-200", emoji: "🆕" },
  active: { label: "Active", color: "bg-blue-50 text-blue-700", textColor: "text-blue-700", borderColor: "border-blue-200", emoji: "✅" },
  inactive: { label: "Inactive", color: "bg-orange-50 text-orange-700", textColor: "text-orange-700", borderColor: "border-orange-200", emoji: "😴" },
  lost: { label: "Lost", color: "bg-red-50 text-red-700", textColor: "text-red-700", borderColor: "border-red-200", emoji: "💀" },
};

const SEGMENT_PILLS = [
  { key: "all", label: "All", emoji: "👥" },
  { key: "diamond", label: "Diamond", emoji: "💎" },
  { key: "gold", label: "Gold", emoji: "👑" },
  { key: "silver", label: "Silver", emoji: "⭐" },
  { key: "repeat", label: "Repeat", emoji: "🔄" },
  { key: "new", label: "New", emoji: "🆕" },
  { key: "inactive", label: "Inactive", emoji: "😴" },
  { key: "lost", label: "Lost", emoji: "💀" },
  { key: "blocked", label: "Blocked", emoji: "🚫" },
  { key: "risky", label: "Risky", emoji: "⚠️" },
];

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState("customers");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [drawerCustomer, setDrawerCustomer] = useState<CRMCustomer | null>(null);
  const [followupFilter, setFollowupFilter] = useState("all");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddFollowup, setShowAddFollowup] = useState(false);
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("Hi {name}, hope you're doing well!");
  const [newCustomer, setNewCustomer] = useState({ full_name: "", phone: "", email: "", address: "", district: "" });
  const [newLead, setNewLead] = useState({ name: "", phone: "", source: "facebook", stage: "warm", note: "" });
  const [newFollowup, setNewFollowup] = useState({ phone: "", note: "", date: undefined as Date | undefined, time: "10:00" });
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);

  const searchTimeout = useCallback((val: string) => {
    setSearch(val);
    const t = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(t);
  }, []);

  const { data: customers = [], isLoading: customersLoading } = useCustomers(debouncedSearch, segmentFilter);
  const { data: followups = [], isLoading: followupsLoading } = useFollowups(followupFilter);
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const mutations = useCRMMutations();

  const allCustomers = useCustomers("", "all");
  const allData = allCustomers.data || [];

  const stats = useMemo(() => {
    const totalSpent = allData.reduce((s, c) => s + (c.total_spent || 0), 0);
    return {
      total: allData.length,
      active: allData.filter((c) => c.computed_segment === "active").length,
      new_: allData.filter((c) => c.computed_segment === "new").length,
      inactive: allData.filter((c) => c.computed_segment === "inactive").length,
      lost: allData.filter((c) => c.computed_segment === "lost").length,
      diamond: allData.filter((c) => c.computed_segment === "diamond").length,
      gold: allData.filter((c) => c.computed_segment === "gold").length,
      silver: allData.filter((c) => c.computed_segment === "silver").length,
      repeat: allData.filter((c) => c.is_repeat).length,
      revenue: totalSpent,
    };
  }, [allData]);

  const todayFollowups = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    return followups.filter((f) => {
      const d = new Date(f.due_at);
      return (d <= todayEnd && !f.is_done) || (d < todayStart && !f.is_done);
    }).slice(0, 6);
  }, [followups]);

  const topSpenders = useMemo(() => {
    return [...allData].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).slice(0, 5);
  }, [allData]);

  const segmentChartData = useMemo(() => [
    { name: "Diamond", count: stats.diamond, fill: "#7c3aed" },
    { name: "Gold", count: stats.gold, fill: "#b45309" },
    { name: "Silver", count: stats.silver, fill: "#475569" },
    { name: "Active", count: stats.active, fill: "#3b82f6" },
    { name: "New", count: stats.new_, fill: "#059669" },
    { name: "Inactive", count: stats.inactive, fill: "#d97706" },
    { name: "Lost", count: stats.lost, fill: "#dc2626" },
    { name: "Leads", count: leads.length, fill: "#4f46e5" },
  ], [stats, leads]);

  // Pagination
  const pagedCustomers = useMemo(() => {
    const start = page * perPage;
    return customers.slice(start, start + perPage);
  }, [customers, page, perPage]);

  const totalPages = Math.ceil(customers.length / perPage);

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === pagedCustomers.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(pagedCustomers.map((c) => c.id)));
  };

  const selectedCustomers = customers.filter((c) => selectedRows.has(c.id));

  const getSuccessColor = (rate: number | null | undefined) => {
    if (rate == null) return "text-muted-foreground";
    if (rate >= 80) return "text-emerald-600";
    if (rate >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const getLastOrderColor = (date: string | null | undefined) => {
    if (!date) return "text-muted-foreground";
    const days = differenceInDays(new Date(), new Date(date));
    if (days < 30) return "text-emerald-600";
    if (days <= 60) return "text-amber-600";
    return "text-red-600";
  };

  const handleAddCustomer = () => {
    if (!newCustomer.full_name || !newCustomer.phone) return;
    mutations.addCustomer.mutate(newCustomer);
    setShowAddCustomer(false);
    setNewCustomer({ full_name: "", phone: "", email: "", address: "", district: "" });
  };

  const handleAddLead = () => {
    if (!newLead.name || !newLead.phone) return;
    mutations.addLead.mutate(newLead);
    setShowAddLead(false);
    setNewLead({ name: "", phone: "", source: "facebook", stage: "warm", note: "" });
  };

  const handleAddFollowup = () => {
    if (!newFollowup.phone || !newFollowup.note || !newFollowup.date) return;
    const [h, m] = newFollowup.time.split(":").map(Number);
    const dt = new Date(newFollowup.date);
    dt.setHours(h, m, 0, 0);
    mutations.addFollowup.mutate({
      customer_phone: newFollowup.phone,
      note: newFollowup.note,
      due_at: dt.toISOString(),
    });
    setShowAddFollowup(false);
    setNewFollowup({ phone: "", note: "", date: undefined, time: "10:00" });
  };

  const getSegBadge = (c: CRMCustomer) => {
    const seg = SEGMENT_CONFIG[c.computed_segment] || SEGMENT_CONFIG.active;
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className={cn("text-[10px] font-medium border", seg.color, seg.borderColor)}>
          {seg.emoji} {seg.label}
        </Badge>
        {c.is_repeat && (
          <Badge variant="outline" className="text-[10px] font-medium border bg-sky-50 text-sky-700 border-sky-200">
            🔄
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "#f7f8fc" }}>
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-white border-b" style={{ borderColor: "#eaecf3" }}>
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold" style={{ fontFamily: "Sora, sans-serif" }}>CRM</h1>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-medium">
              {stats.total.toLocaleString()} Customers
            </Badge>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium">
              {todayFollowups.length} Follow-ups Today
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs border-[#eaecf3]">
              <Download className="w-3.5 h-3.5 mr-1" /> Export
            </Button>
            <Button variant="outline" size="sm" className="text-xs border-[#eaecf3]" onClick={() => setShowImport(true)}>
              📥 Import
            </Button>
            <Button variant="outline" size="sm" className="text-xs border-[#eaecf3]">
              💬 Bulk Message
            </Button>
            <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowAddCustomer(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Customer
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* TABS */}
          <div className="bg-white rounded-xl border" style={{ borderColor: "#eaecf3" }}>
            <TabsList className="bg-transparent w-full justify-start px-4 h-11 border-b" style={{ borderColor: "#eaecf3" }}>
              {[
                { value: "customers", label: "👥 Customers" },
                { value: "followups", label: "📞 Follow-ups" },
                { value: "leads", label: "🎯 Leads" },
                { value: "segments", label: "📊 Segments" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className={cn(
                    "text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none"
                  )}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* STATS BAR */}
          <div className="grid grid-cols-8 gap-3">
            {[
              { label: "TOTAL", value: stats.total, sub: "customers", color: "text-foreground" },
              { label: "ACTIVE", value: stats.active, sub: "ordered <60d", color: "text-blue-600" },
              { label: "NEW", value: stats.new_, sub: "first order <30d", color: "text-emerald-600" },
              { label: "INACTIVE", value: stats.inactive, sub: "60–90 days", color: "text-amber-600" },
              { label: "LOST", value: stats.lost, sub: "90+ days", color: "text-red-600" },
              { label: "FOLLOW-UPS", value: todayFollowups.length, sub: "due today", color: "text-orange-600" },
              { label: "LEADS", value: leads.length, sub: "unconverted", color: "text-indigo-600" },
              { label: "REVENUE", value: `৳${(stats.revenue / 1000).toFixed(0)}k`, sub: "lifetime", color: "text-emerald-600" },
            ].map((s) => (
              <Card key={s.label} className="bg-white border hover:border-indigo-200 transition-colors" style={{ borderColor: "#eaecf3" }}>
                <CardContent className="p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className={cn("text-xl font-bold mt-0.5", s.color)} style={{ fontFamily: "Sora, sans-serif" }}>
                    {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* VIP TIERS ROW */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: "diamond", label: "Diamond", emoji: "💎", count: stats.diamond, rule: "Spent ৳10,000+", border: "border-purple-300", bg: "bg-purple-50/60", text: "text-purple-700" },
              { key: "gold", label: "Gold", emoji: "👑", count: stats.gold, rule: "Spent ৳5,000–9,999", border: "border-amber-300", bg: "bg-amber-50/60", text: "text-amber-700" },
              { key: "silver", label: "Silver", emoji: "⭐", count: stats.silver, rule: "Spent ৳2,000–4,999", border: "border-slate-300", bg: "bg-slate-50/60", text: "text-slate-600" },
              { key: "repeat", label: "Repeat Buyer", emoji: "🔄", count: stats.repeat, rule: "3+ orders any amount", border: "border-sky-300", bg: "bg-sky-50/60", text: "text-sky-700" },
            ].map((v) => (
              <Card
                key={v.key}
                className={cn("border cursor-pointer hover:shadow-md transition-all", v.border, v.bg)}
                onClick={() => { setActiveTab("customers"); setSegmentFilter(v.key); }}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="text-2xl">{v.emoji}</span>
                  <div className="flex-1">
                    <p className={cn("text-sm font-semibold", v.text)}>{v.label}</p>
                    <p className="text-[10px] text-muted-foreground">{v.rule}</p>
                  </div>
                  <p className={cn("text-2xl font-bold", v.text)} style={{ fontFamily: "Sora, sans-serif" }}>{v.count}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* MAIN LAYOUT */}
          <div className="grid grid-cols-[1fr_300px] gap-4">
            <div className="space-y-4">
              {/* ─── CUSTOMERS TAB ─── */}
              <TabsContent value="customers" className="mt-0 space-y-0">
                <Card className="bg-white border" style={{ borderColor: "#eaecf3" }}>
                  {/* Filters inside card */}
                  <div className="p-4 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: "#eaecf3" }}>
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search name or phone..."
                        value={search}
                        onChange={(e) => searchTimeout(e.target.value)}
                        className="pl-9 h-9 text-sm border-[#eaecf3]"
                      />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {SEGMENT_PILLS.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => { setSegmentFilter(p.key); setPage(0); }}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                            segmentFilter === p.key
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white border-[#eaecf3] text-muted-foreground hover:border-indigo-300"
                          )}
                        >
                          {p.emoji} {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table */}
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b" style={{ borderColor: "#eaecf3" }}>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedRows.size === pagedCustomers.length && pagedCustomers.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">District</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Orders</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Delivered</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Returns</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Risk</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 9 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : pagedCustomers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                            <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No customers found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedCustomers.map((c) => {
                          const initials = c.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                          const hasRisk = (c.risk_flags || []).length > 0;
                          return (
                            <TableRow
                              key={c.id}
                              className={cn("cursor-pointer hover:bg-slate-50/80 transition-colors border-b", c.is_blocked && "opacity-60 bg-red-50/30")}
                              style={{ borderColor: "#eaecf3" }}
                              onClick={() => setDrawerCustomer(c)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox checked={selectedRows.has(c.id)} onCheckedChange={() => toggleRow(c.id)} />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className={cn("w-8 h-8 rounded-[10px] flex items-center justify-center text-xs font-bold flex-shrink-0", getAvatarColor(c.full_name))}>
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                                      {c.is_blocked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">🚫</span>}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">{c.phone}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">{c.district || "—"}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-medium">{c.total_orders}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-medium text-emerald-600">{c.delivered_count || 0}</span>
                              </TableCell>
                              <TableCell>
                                <span className={cn("text-sm font-medium", (c.return_count || 0) > 0 ? "text-red-600" : "text-muted-foreground")}>
                                  {c.return_count || 0}
                                  {(c.return_rate || 0) > 0 && <span className="text-[10px] ml-0.5">({c.return_rate}%)</span>}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-bold text-emerald-600">৳{(c.total_spent || 0).toLocaleString()}</span>
                              </TableCell>
                              <TableCell>
                                {hasRisk ? (
                                  <div className="flex flex-wrap gap-1">
                                    {(c.risk_flags || []).map((f) => (
                                      <span key={f} className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-700 border border-red-200 font-medium">
                                        {f === "high_return" ? "⚠️ High Return" : f === "frequent_cancel" ? "❌ Cancels" : f}
                                      </span>
                                    ))}
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell>
                                {c.is_blocked ? (
                                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">🚫 Blocked</Badge>
                                ) : (
                                  getSegBadge(c)
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {customers.length > 0 && (
                    <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: "#eaecf3" }}>
                      <p className="text-xs text-muted-foreground">
                        Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, customers.length)} of {customers.length.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(0); }}>
                          <SelectTrigger className="h-7 w-20 text-xs border-[#eaecf3]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-xs border-[#eaecf3]" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
                          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                            <Button
                              key={i}
                              variant={page === i ? "default" : "outline"}
                              size="sm"
                              className={cn("h-7 w-7 text-xs p-0", page === i ? "bg-indigo-600" : "border-[#eaecf3]")}
                              onClick={() => setPage(i)}
                            >
                              {i + 1}
                            </Button>
                          ))}
                          <Button variant="outline" size="sm" className="h-7 text-xs border-[#eaecf3]" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* ─── FOLLOW-UPS TAB ─── */}
              <TabsContent value="followups" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {[
                      { key: "all", label: "All" },
                      { key: "overdue", label: "⚠️ Overdue" },
                      { key: "today", label: "🕐 Today" },
                      { key: "week", label: "📅 This Week" },
                      { key: "done", label: "✅ Done" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFollowupFilter(f.key)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                          followupFilter === f.key
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white border-[#eaecf3] text-muted-foreground hover:border-indigo-300"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowAddFollowup(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Follow-up
                  </Button>
                </div>
                <div className="space-y-2">
                  {followupsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
                  ) : followups.length === 0 ? (
                    <Card className="py-16 bg-white border" style={{ borderColor: "#eaecf3" }}>
                      <p className="text-center text-muted-foreground text-sm">No follow-ups found</p>
                    </Card>
                  ) : (
                    followups.map((f) => {
                      const isOverdue = new Date(f.due_at) < startOfDay(new Date()) && !f.is_done;
                      const isToday = new Date(f.due_at) >= startOfDay(new Date()) && new Date(f.due_at) <= endOfDay(new Date());
                      return (
                        <Card
                          key={f.id}
                          className={cn(
                            "transition-all bg-white border",
                            isOverdue && "border-red-200 bg-red-50/40",
                            isToday && !isOverdue && "border-orange-200 bg-orange-50/40",
                            f.is_done && "opacity-50"
                          )}
                          style={!isOverdue && !isToday ? { borderColor: "#eaecf3" } : {}}
                        >
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-bold flex-shrink-0", getAvatarColor(f.customer_name || "?"))}>
                              {(f.customer_name || "?")[0]}
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                              const cust = allData.find((c) => c.phone === f.customer_phone);
                              if (cust) setDrawerCustomer(cust);
                            }}>
                              <p className="text-sm font-semibold">{f.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{f.note}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {format(new Date(f.due_at), "PPp")}
                                {isOverdue && <span className="text-red-600 font-medium ml-1">• Overdue</span>}
                              </p>
                            </div>
                            {!f.is_done && (
                              <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs" onClick={() => mutations.markFollowupDone.mutate(f.id)}>
                                <Check className="w-3.5 h-3.5 mr-1" /> Done
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* ─── LEADS TAB ─── */}
              <TabsContent value="leads" className="mt-0 space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowAddLead(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Lead
                  </Button>
                </div>
                <Card className="bg-white border" style={{ borderColor: "#eaecf3" }}>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b" style={{ borderColor: "#eaecf3" }}>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name & Phone</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Note</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Added</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>))}</TableRow>
                        ))
                      ) : leads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                            <Target className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No leads yet</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        leads.map((l) => (
                          <TableRow key={l.id} className="border-b" style={{ borderColor: "#eaecf3" }}>
                            <TableCell>
                              <p className="text-sm font-medium">{l.name}</p>
                              <p className="text-[11px] text-muted-foreground">{l.phone}</p>
                            </TableCell>
                            <TableCell><span className="text-xs capitalize">{l.source}</span></TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[10px] border font-medium",
                                l.stage === "hot" && "bg-red-50 text-red-700 border-red-200",
                                l.stage === "warm" && "bg-orange-50 text-orange-700 border-orange-200",
                                l.stage === "cold" && "bg-blue-50 text-blue-700 border-blue-200"
                              )}>
                                {l.stage === "hot" ? "🔴 Hot" : l.stage === "warm" ? "🟠 Warm" : "🔵 Cold"}
                              </Badge>
                            </TableCell>
                            <TableCell><p className="text-xs text-muted-foreground truncate max-w-[180px]">{l.note || "—"}</p></TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">{l.created_at ? formatDistanceToNow(new Date(l.created_at), { addSuffix: true }) : "—"}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7" onClick={() => mutations.convertLead.mutate(l)}>
                                ✅ Convert
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              {/* ─── SEGMENTS TAB ─── */}
              <TabsContent value="segments" className="mt-0 space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "diamond", label: "Diamond", desc: "Spent ৳10k+", emoji: "💎", border: "border-purple-200", bg: "bg-purple-50/50" },
                    { key: "gold", label: "Gold", desc: "Spent ৳5k–9,999", emoji: "👑", border: "border-amber-200", bg: "bg-amber-50/50" },
                    { key: "silver", label: "Silver", desc: "Spent ৳2k–4,999", emoji: "⭐", border: "border-slate-200", bg: "bg-slate-50/50" },
                    { key: "new", label: "New", desc: "First order <30 days", emoji: "🆕", border: "border-emerald-200", bg: "bg-emerald-50/50" },
                    { key: "active", label: "Active", desc: "Ordered <60 days", emoji: "✅", border: "border-blue-200", bg: "bg-blue-50/50" },
                    { key: "leads", label: "Leads", desc: "Not ordered yet", emoji: "🎯", border: "border-indigo-200", bg: "bg-indigo-50/50" },
                  ].map((s) => {
                    const count = s.key === "leads" ? leads.length : allData.filter((c) => c.computed_segment === s.key).length;
                    return (
                      <Card key={s.key} className={cn("border cursor-pointer hover:shadow-md transition-all", s.border, s.bg)} onClick={() => {
                        if (s.key === "leads") setActiveTab("leads");
                        else { setActiveTab("customers"); setSegmentFilter(s.key); }
                      }}>
                        <CardContent className="p-4">
                          <span className="text-2xl">{s.emoji}</span>
                          <p className="text-sm font-semibold mt-2">{s.label}</p>
                          <p className="text-2xl font-bold mt-1" style={{ fontFamily: "Sora, sans-serif" }}>{count}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{s.desc}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card className="bg-white border" style={{ borderColor: "#eaecf3" }}>
                  <CardHeader><CardTitle className="text-sm">Customer Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={segmentChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eaecf3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                            {segmentChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border" style={{ borderColor: "#eaecf3" }}>
                  <CardHeader><CardTitle className="text-sm">Top 5 VIP Customers</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {topSpenders.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => setDrawerCustomer(c)}>
                        <span className="text-sm font-bold text-muted-foreground w-5">{i === 0 ? "👑" : `#${i + 1}`}</span>
                        <div className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center text-xs font-bold", getAvatarColor(c.full_name))}>{c.full_name[0]}</div>
                        <span className="text-sm font-medium flex-1">{c.full_name}</span>
                        <span className="text-sm font-bold text-emerald-600">৳{(c.total_spent || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-white border" style={{ borderColor: "#eaecf3" }}>
                  <CardHeader><CardTitle className="text-sm">🔄 Win-back List</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {allData
                      .filter((c) => (c.computed_segment === "inactive" || c.computed_segment === "lost") && (c.total_spent || 0) >= 5000)
                      .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
                      .slice(0, 5)
                      .map((c) => (
                        <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => setDrawerCustomer(c)}>
                          <div className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center text-xs font-bold", getAvatarColor(c.full_name))}>{c.full_name[0]}</div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{c.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">Last: {c.last_order_date ? formatDistanceToNow(new Date(c.last_order_date), { addSuffix: true }) : "Never"}</p>
                          </div>
                          <span className="text-sm font-bold text-emerald-600">৳{(c.total_spent || 0).toLocaleString()}</span>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            {/* ─── RIGHT SIDEBAR ─── */}
            <div className="space-y-4">
              {/* Follow-ups Today */}
              <Card className="bg-white border" style={{ borderColor: "#eaecf3" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    📞 Follow-ups Today
                    {todayFollowups.length > 0 && (
                      <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">{todayFollowups.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {todayFollowups.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No follow-ups today</p>
                  ) : (
                    todayFollowups.map((f) => {
                      const isOverdue = new Date(f.due_at) < startOfDay(new Date());
                      return (
                        <div key={f.id} className={cn("p-2.5 rounded-lg border text-xs", isOverdue ? "bg-red-50/50 border-red-200" : "bg-orange-50/50 border-orange-200")}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">{f.customer_name}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600" onClick={() => mutations.markFollowupDone.mutate(f.id)}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <p className="text-muted-foreground mt-0.5">{f.note}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(f.due_at), "p")}</p>
                        </div>
                      );
                    })
                  )}
                  {todayFollowups.length > 0 && (
                    <Button variant="link" size="sm" className="w-full text-xs text-indigo-600" onClick={() => setActiveTab("followups")}>View all →</Button>
                  )}
                </CardContent>
              </Card>

              {/* Segment Mini */}
              <Card className="bg-white border" style={{ borderColor: "#eaecf3" }}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">📊 Segments</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "diamond", emoji: "💎", count: stats.diamond, color: "bg-purple-50 border-purple-200 text-purple-700" },
                      { key: "gold", emoji: "👑", count: stats.gold, color: "bg-amber-50 border-amber-200 text-amber-700" },
                      { key: "silver", emoji: "⭐", count: stats.silver, color: "bg-slate-50 border-slate-300 text-slate-600" },
                      { key: "active", emoji: "✅", count: stats.active, color: "bg-blue-50 border-blue-200 text-blue-700" },
                      { key: "inactive", emoji: "😴", count: stats.inactive, color: "bg-orange-50 border-orange-200 text-orange-700" },
                      { key: "lost", emoji: "💀", count: stats.lost, color: "bg-red-50 border-red-200 text-red-700" },
                    ].map((s) => (
                      <button
                        key={s.key}
                        className={cn("p-2 rounded-lg border text-center transition-colors hover:shadow-sm", s.color)}
                        onClick={() => { setActiveTab("customers"); setSegmentFilter(s.key); }}
                      >
                        <div className="text-base">{s.emoji}</div>
                        <div className="text-lg font-bold" style={{ fontFamily: "Sora, sans-serif" }}>{s.count}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Spenders */}
              <Card className="bg-white border" style={{ borderColor: "#eaecf3" }}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">💰 Top Spenders</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {topSpenders.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => setDrawerCustomer(c)}>
                      <span className="text-xs font-bold text-muted-foreground w-4">
                        {i === 0 ? <Crown className="w-4 h-4 text-amber-500" /> : `#${i + 1}`}
                      </span>
                      <div className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center text-xs font-bold", getAvatarColor(c.full_name))}>{c.full_name[0]}</div>
                      <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{c.full_name}</p></div>
                      <span className="text-xs font-bold text-emerald-600">৳{(c.total_spent || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </Tabs>
      </div>

      {/* ─── BULK ACTION BAR ─── */}
      {selectedRows.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 flex items-center gap-4 rounded-xl border shadow-2xl"
          style={{ background: "#0f1221", borderColor: "#2a2d3e", animation: "slide-up 0.3s ease-out" }}>
          <span className="text-sm font-medium text-white">{selectedRows.size} customers selected</span>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={() => setShowBulkWhatsApp(true)}>
            💬 WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs">
            🏷️ Tag
          </Button>
          <Button size="sm" variant="outline" className="text-orange-400 border-orange-500/30 hover:bg-orange-500/10 text-xs">
            ⏰ Follow-up
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={() => setSelectedRows(new Set())}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ─── MODALS & DRAWERS ─── */}
      <CustomerImportModal open={showImport} onClose={() => setShowImport(false)} />
      <CustomerProfileDrawer customer={drawerCustomer} open={!!drawerCustomer} onClose={() => setDrawerCustomer(null)} />

      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent>
          <DialogHeader><DialogTitle>➕ Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Full Name *" value={newCustomer.full_name} onChange={(e) => setNewCustomer({ ...newCustomer, full_name: e.target.value })} />
            <Input placeholder="Phone *" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
            <Input placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
            <Input placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
            <Input placeholder="District / City" value={newCustomer.district} onChange={(e) => setNewCustomer({ ...newCustomer, district: e.target.value })} />
          </div>
          <DialogFooter>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleAddCustomer} disabled={!newCustomer.full_name || !newCustomer.phone}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent>
          <DialogHeader><DialogTitle>🎯 Add Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name *" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} />
            <Input placeholder="Phone *" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} />
            <Select value={newLead.source} onValueChange={(v) => setNewLead({ ...newLead, source: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="walk-in">Walk-in</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newLead.stage} onValueChange={(v) => setNewLead({ ...newLead, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hot">🔴 Hot</SelectItem>
                <SelectItem value="warm">🟠 Warm</SelectItem>
                <SelectItem value="cold">🔵 Cold</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Note" value={newLead.note} onChange={(e) => setNewLead({ ...newLead, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleAddLead} disabled={!newLead.name || !newLead.phone}>Add Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddFollowup} onOpenChange={setShowAddFollowup}>
        <DialogContent>
          <DialogHeader><DialogTitle>⏰ Schedule Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Customer Phone *" value={newFollowup.phone} onChange={(e) => setNewFollowup({ ...newFollowup, phone: e.target.value })} />
            <Textarea placeholder="Note *" value={newFollowup.note} onChange={(e) => setNewFollowup({ ...newFollowup, note: e.target.value })} />
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {newFollowup.date ? format(newFollowup.date, "PP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newFollowup.date} onSelect={(d) => setNewFollowup({ ...newFollowup, date: d })} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Input type="time" value={newFollowup.time} onChange={(e) => setNewFollowup({ ...newFollowup, time: e.target.value })} className="w-28" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleAddFollowup} disabled={!newFollowup.phone || !newFollowup.note || !newFollowup.date}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkWhatsApp} onOpenChange={setShowBulkWhatsApp}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>💬 Bulk WhatsApp Message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} placeholder="Use {name}, {last_order}, {total_spent}" className="min-h-[100px]" />
            <div className="text-xs text-muted-foreground">Variables: <code>{"{name}"}</code> <code>{"{last_order}"}</code> <code>{"{total_spent}"}</code></div>
            {selectedCustomers.length > 0 && (
              <Card className="bg-slate-50 border" style={{ borderColor: "#eaecf3" }}>
                <CardContent className="p-3">
                  <p className="text-xs font-semibold mb-1">Preview ({selectedCustomers[0].full_name}):</p>
                  <p className="text-sm">
                    {bulkMessage
                      .replace("{name}", selectedCustomers[0].full_name)
                      .replace("{last_order}", selectedCustomers[0].last_order_date ? format(new Date(selectedCustomers[0].last_order_date), "PP") : "N/A")
                      .replace("{total_spent}", `৳${(selectedCustomers[0].total_spent || 0).toLocaleString()}`)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
              selectedCustomers.forEach((c) => {
                const msg = bulkMessage
                  .replace("{name}", c.full_name)
                  .replace("{last_order}", c.last_order_date ? format(new Date(c.last_order_date), "PP") : "N/A")
                  .replace("{total_spent}", `৳${(c.total_spent || 0).toLocaleString()}`);
                window.open(`https://wa.me/880${c.phone.replace(/^0/, "")}?text=${encodeURIComponent(msg)}`, "_blank");
              });
              setShowBulkWhatsApp(false);
            }}>
              Send to {selectedCustomers.length} customers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
