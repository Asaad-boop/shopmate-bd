import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  Users, Star, Sparkles, Moon, Skull, Target, Phone, MessageCircle,
  Clock, Plus, CalendarIcon, Search, Check, ExternalLink, TrendingUp,
  Crown, Download, X,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  useCustomers, useFollowups, useLeads, useCRMMutations,
  CRMCustomer, Followup, Lead,
} from "@/hooks/use-crm";
import { CustomerProfileDrawer } from "@/components/crm/CustomerProfileDrawer";
import { CustomerImportModal } from "@/components/crm/CustomerImportModal";

const SEGMENT_CONFIG: Record<string, { label: string; color: string; emoji: string; bgColor: string }> = {
  vip: { label: "VIP", color: "bg-yellow-100 text-yellow-800 border-yellow-300", emoji: "⭐", bgColor: "from-yellow-50 to-yellow-100/50" },
  new: { label: "New", color: "bg-green-100 text-green-800 border-green-300", emoji: "🆕", bgColor: "from-green-50 to-green-100/50" },
  active: { label: "Active", color: "bg-blue-100 text-blue-800 border-blue-300", emoji: "✅", bgColor: "from-blue-50 to-blue-100/50" },
  inactive: { label: "Inactive", color: "bg-orange-100 text-orange-800 border-orange-300", emoji: "😴", bgColor: "from-orange-50 to-orange-100/50" },
  lost: { label: "Lost", color: "bg-red-100 text-red-800 border-red-300", emoji: "💀", bgColor: "from-red-50 to-red-100/50" },
};

const SEGMENT_PILLS = [
  { key: "all", label: "All", emoji: "👥" },
  { key: "vip", label: "VIP", emoji: "⭐" },
  { key: "new", label: "New", emoji: "🆕" },
  { key: "inactive", label: "Inactive", emoji: "😴" },
  { key: "lost", label: "Lost", emoji: "💀" },
  { key: "active", label: "Active", emoji: "✅" },
];

export default function CRMPage() {
  const navigate = useNavigate();
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

  // Debounced search
  const searchTimeout = useCallback((val: string) => {
    setSearch(val);
    const t = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(t);
  }, []);

  const { data: customers = [], isLoading: customersLoading } = useCustomers(debouncedSearch, segmentFilter);
  const { data: followups = [], isLoading: followupsLoading } = useFollowups(followupFilter);
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const mutations = useCRMMutations();

  // Stats
  const allCustomers = useCustomers("", "all");
  const stats = useMemo(() => {
    const all = allCustomers.data || [];
    return {
      total: all.length,
      vip: all.filter((c) => c.computed_segment === "vip").length,
      new_: all.filter((c) => c.computed_segment === "new").length,
      inactive: all.filter((c) => c.computed_segment === "inactive").length,
      lost: all.filter((c) => c.computed_segment === "lost").length,
      active: all.filter((c) => c.computed_segment === "active").length,
    };
  }, [allCustomers.data]);

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
    return [...(allCustomers.data || [])].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).slice(0, 5);
  }, [allCustomers.data]);

  const segmentChartData = useMemo(() => {
    return [
      { name: "VIP", count: stats.vip, fill: "#eab308" },
      { name: "Active", count: stats.active, fill: "#3b82f6" },
      { name: "New", count: stats.new_, fill: "#10b981" },
      { name: "Inactive", count: stats.inactive, fill: "#f59e0b" },
      { name: "Lost", count: stats.lost, fill: "#ef4444" },
      { name: "Leads", count: leads.length, fill: "#6c63ff" },
    ];
  }, [stats, leads]);

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === customers.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(customers.map((c) => c.id)));
    }
  };

  const selectedCustomers = customers.filter((c) => selectedRows.has(c.id));

  const getSuccessColor = (rate: number | null | undefined) => {
    if (rate == null) return "text-muted-foreground";
    if (rate >= 80) return "text-green-700";
    if (rate >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const getLastOrderColor = (date: string | null | undefined) => {
    if (!date) return "text-muted-foreground";
    const days = differenceInDays(new Date(), new Date(date));
    if (days < 30) return "text-green-700";
    if (days <= 60) return "text-orange-600";
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

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* HEADER */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="flex items-center justify-between px-6 h-[54px]">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">👥 CRM</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              {stats.total} Customers
            </Badge>
            <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
              {todayFollowups.length} Follow-ups Today
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-3.5 h-3.5 mr-1" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              📥 Import Customers
            </Button>
            <Button variant="outline" size="sm">
              💬 Bulk Message
            </Button>
            <Button size="sm" onClick={() => setShowAddCustomer(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Customer
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-transparent border-b w-full justify-start">
            <TabsTrigger value="customers">👥 Customers</TabsTrigger>
            <TabsTrigger value="followups">📞 Follow-ups</TabsTrigger>
            <TabsTrigger value="leads">🎯 Leads</TabsTrigger>
            <TabsTrigger value="segments">📊 Segments</TabsTrigger>
          </TabsList>

          {/* STATS */}
          <div className="grid grid-cols-6 gap-3 mt-4">
            {[
              { label: "Total Customers", value: stats.total, icon: Users, color: "text-primary", bg: "from-primary/5 to-primary/10" },
              { label: "VIP", value: stats.vip, icon: Star, color: "text-yellow-600", bg: "from-yellow-50 to-yellow-100/50" },
              { label: "New", value: stats.new_, icon: Sparkles, color: "text-green-600", bg: "from-green-50 to-green-100/50" },
              { label: "Inactive", value: stats.inactive, icon: Moon, color: "text-orange-600", bg: "from-orange-50 to-orange-100/50" },
              { label: "Lost", value: stats.lost, icon: Skull, color: "text-red-600", bg: "from-red-50 to-red-100/50" },
              { label: "Active Leads", value: leads.length, icon: Target, color: "text-blue-600", bg: "from-blue-50 to-blue-100/50" },
            ].map((s) => (
              <Card
                key={s.label}
                className={cn("bg-gradient-to-br border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer", s.bg)}
                onClick={() => {
                  if (s.label === "Active Leads") setActiveTab("leads");
                  else {
                    setActiveTab("customers");
                    const seg = s.label.toLowerCase().replace(" ", "");
                    if (seg === "totalcustomers") setSegmentFilter("all");
                    else if (seg === "activeleads") setActiveTab("leads");
                    else setSegmentFilter(s.label === "New" ? "new" : s.label === "VIP" ? "vip" : s.label === "Inactive" ? "inactive" : s.label === "Lost" ? "lost" : "all");
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
                    </div>
                    <s.icon className={cn("w-8 h-8 opacity-20", s.color)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* MAIN LAYOUT */}
          <div className="grid grid-cols-[1fr_340px] gap-6 mt-4">
            {/* LEFT */}
            <div className="space-y-4">
              {/* CUSTOMERS TAB */}
              <TabsContent value="customers" className="mt-0 space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search name or phone..."
                      value={search}
                      onChange={(e) => searchTimeout(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-1">
                    {SEGMENT_PILLS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setSegmentFilter(p.key)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                          segmentFilter === p.key
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {p.emoji} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedRows.size === customers.length && customers.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Segment</TableHead>
                        <TableHead>Total Spent</TableHead>
                        <TableHead>Success</TableHead>
                        <TableHead>Last Order</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 8 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                            No customers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((c) => {
                          const seg = SEGMENT_CONFIG[c.computed_segment] || SEGMENT_CONFIG.active;
                          const initials = c.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                          return (
                            <TableRow
                              key={c.id}
                              className="cursor-pointer"
                              onClick={() => setDrawerCustomer(c)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedRows.has(c.id)}
                                  onCheckedChange={() => toggleRow(c.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {initials}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{c.full_name}</p>
                                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px] border", seg.color)}>
                                  {seg.emoji} {seg.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-bold text-green-700">
                                  ৳{(c.total_spent || 0).toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={cn("text-sm font-medium", getSuccessColor(c.success_rate))}>
                                  {c.success_rate != null ? `${c.success_rate}%` : "—"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={cn("text-xs", getLastOrderColor(c.last_order_date))}>
                                  {c.last_order_date
                                    ? formatDistanceToNow(new Date(c.last_order_date), { addSuffix: true })
                                    : "Never"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {((c.tags as string[]) || []).slice(0, 2).map((t) => (
                                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1 justify-end">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`tel:${c.phone}`)}>
                                    <Phone className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-green-700"
                                    onClick={() => window.open(`https://wa.me/880${c.phone.replace(/^0/, "")}`, "_blank")}
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600" onClick={() => {
                                    setNewFollowup({ ...newFollowup, phone: c.phone });
                                    setShowAddFollowup(true);
                                  }}>
                                    <Clock className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              {/* FOLLOW-UPS TAB */}
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
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                          followupFilter === f.key
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" onClick={() => setShowAddFollowup(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Follow-up
                  </Button>
                </div>
                <div className="space-y-2">
                  {followupsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
                  ) : followups.length === 0 ? (
                    <Card className="py-12">
                      <p className="text-center text-muted-foreground">No follow-ups found</p>
                    </Card>
                  ) : (
                    followups.map((f) => {
                      const isOverdue = new Date(f.due_at) < startOfDay(new Date()) && !f.is_done;
                      const isToday = new Date(f.due_at) >= startOfDay(new Date()) && new Date(f.due_at) <= endOfDay(new Date());
                      return (
                        <Card
                          key={f.id}
                          className={cn(
                            "transition-all",
                            isOverdue && "border-red-300 bg-red-50/50",
                            isToday && !isOverdue && "border-orange-300 bg-orange-50/50",
                            f.is_done && "opacity-60"
                          )}
                        >
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {(f.customer_name || "?")[0]}
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                              const cust = (allCustomers.data || []).find((c) => c.phone === f.customer_phone);
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
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => mutations.markFollowupDone.mutate(f.id)}
                              >
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

              {/* LEADS TAB */}
              <TabsContent value="leads" className="mt-0 space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setShowAddLead(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Lead
                  </Button>
                </div>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name & Phone</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 6 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : leads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            No leads yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        leads.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{l.name}</p>
                              <p className="text-xs text-muted-foreground">{l.phone}</p>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs capitalize">{l.source}</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] border",
                                  l.stage === "hot" && "bg-red-100 text-red-800 border-red-300",
                                  l.stage === "warm" && "bg-orange-100 text-orange-800 border-orange-300",
                                  l.stage === "cold" && "bg-blue-100 text-blue-800 border-blue-300"
                                )}
                              >
                                {l.stage === "hot" ? "🔴 Hot" : l.stage === "warm" ? "🟠 Warm" : "🔵 Cold"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{l.note || "—"}</p>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {l.created_at ? formatDistanceToNow(new Date(l.created_at), { addSuffix: true }) : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white text-xs h-7"
                                onClick={() => mutations.convertLead.mutate(l)}
                              >
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

              {/* SEGMENTS TAB */}
              <TabsContent value="segments" className="mt-0 space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "vip", label: "VIP", desc: "Spent ৳10k+", emoji: "⭐", color: "from-yellow-50 to-yellow-100/50 border-yellow-200" },
                    { key: "inactive", label: "Inactive", desc: "No order 60-90 days", emoji: "😴", color: "from-orange-50 to-orange-100/50 border-orange-200" },
                    { key: "lost", label: "Lost", desc: "No order 90+ days", emoji: "💀", color: "from-red-50 to-red-100/50 border-red-200" },
                    { key: "new", label: "New", desc: "First order within 30d", emoji: "🆕", color: "from-green-50 to-green-100/50 border-green-200" },
                    { key: "active", label: "Active", desc: "Ordered within 60 days", emoji: "✅", color: "from-blue-50 to-blue-100/50 border-blue-200" },
                    { key: "leads", label: "Leads", desc: "Not ordered yet", emoji: "🎯", color: "from-purple-50 to-purple-100/50 border-purple-200" },
                  ].map((s) => {
                    const count = s.key === "leads"
                      ? leads.length
                      : (allCustomers.data || []).filter((c) => c.computed_segment === s.key).length;
                    return (
                      <Card key={s.key} className={cn("bg-gradient-to-br border cursor-pointer hover:shadow-md transition-shadow", s.color)} onClick={() => {
                        if (s.key === "leads") setActiveTab("leads");
                        else { setActiveTab("customers"); setSegmentFilter(s.key); }
                      }}>
                        <CardContent className="p-4">
                          <div className="text-2xl mb-1">{s.emoji}</div>
                          <p className="text-sm font-bold">{s.label}</p>
                          <p className="text-2xl font-bold text-primary mt-1">{count}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{s.desc}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Segment Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Customer Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={segmentChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                            {segmentChartData.map((entry, i) => (
                              <rect key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Top VIP */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Top 5 VIP Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {topSpenders.filter(c => c.computed_segment === 'vip').slice(0, 5).map((c, i) => (
                        <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setDrawerCustomer(c)}>
                          <span className="text-sm font-bold text-muted-foreground w-5">{i === 0 ? "👑" : `#${i + 1}`}</span>
                          <div className="w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 flex items-center justify-center text-xs font-bold">
                            {c.full_name[0]}
                          </div>
                          <span className="text-sm font-medium flex-1">{c.full_name}</span>
                          <span className="text-sm font-bold text-green-700">৳{(c.total_spent || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Win-back */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">🔄 Customers to Win Back</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(allCustomers.data || [])
                        .filter((c) => c.computed_segment === "inactive" || c.computed_segment === "lost")
                        .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
                        .slice(0, 5)
                        .map((c) => (
                          <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setDrawerCustomer(c)}>
                            <div className="w-7 h-7 rounded-full bg-red-100 text-red-800 flex items-center justify-center text-xs font-bold">
                              {c.full_name[0]}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{c.full_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Last order: {c.last_order_date ? formatDistanceToNow(new Date(c.last_order_date), { addSuffix: true }) : "Never"}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-green-700">৳{(c.total_spent || 0).toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="space-y-4">
              {/* Follow-ups Today */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    📞 Follow-ups Today
                    {todayFollowups.length > 0 && (
                      <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-[10px]">{todayFollowups.length}</Badge>
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
                        <div
                          key={f.id}
                          className={cn(
                            "p-2.5 rounded-lg border text-xs",
                            isOverdue ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{f.customer_name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-green-700"
                              onClick={() => mutations.markFollowupDone.mutate(f.id)}
                            >
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
                    <Button variant="link" size="sm" className="w-full text-xs" onClick={() => setActiveTab("followups")}>
                      View all →
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Segment Quick View */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">📊 Segments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "vip", emoji: "⭐", count: stats.vip, color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
                      { key: "active", emoji: "✅", count: stats.active, color: "bg-blue-50 border-blue-200 text-blue-800" },
                      { key: "new", emoji: "🆕", count: stats.new_, color: "bg-green-50 border-green-200 text-green-800" },
                      { key: "inactive", emoji: "😴", count: stats.inactive, color: "bg-orange-50 border-orange-200 text-orange-800" },
                      { key: "lost", emoji: "💀", count: stats.lost, color: "bg-red-50 border-red-200 text-red-800" },
                      { key: "leads", emoji: "🎯", count: leads.length, color: "bg-purple-50 border-purple-200 text-purple-800" },
                    ].map((s) => (
                      <button
                        key={s.key}
                        className={cn("p-2 rounded-lg border text-center transition-shadow hover:shadow-sm", s.color)}
                        onClick={() => {
                          if (s.key === "leads") setActiveTab("leads");
                          else { setActiveTab("customers"); setSegmentFilter(s.key); }
                        }}
                      >
                        <div className="text-lg">{s.emoji}</div>
                        <div className="text-lg font-bold">{s.count}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Spenders */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">💰 Top Spenders</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topSpenders.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => setDrawerCustomer(c)}
                    >
                      <span className="text-xs font-bold text-muted-foreground w-4">
                        {i === 0 ? <Crown className="w-4 h-4 text-yellow-500" /> : `#${i + 1}`}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {c.full_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.full_name}</p>
                      </div>
                      <span className="text-xs font-bold text-green-700">৳{(c.total_spent || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </Tabs>
      </div>

      {/* BULK ACTION BAR */}
      {selectedRows.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-xl rounded-xl px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">{selectedRows.size} customers selected</span>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setShowBulkWhatsApp(true)}
          >
            💬 WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="text-orange-600 border-orange-300">
            ⏰ Follow-up
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedRows(new Set())}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Customer Drawer */}
      <CustomerImportModal open={showImport} onClose={() => setShowImport(false)} />
      <CustomerProfileDrawer
        customer={drawerCustomer}
        open={!!drawerCustomer}
        onClose={() => setDrawerCustomer(null)}
      />

      {/* Add Customer Modal */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>➕ Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Full Name *" value={newCustomer.full_name} onChange={(e) => setNewCustomer({ ...newCustomer, full_name: e.target.value })} />
            <Input placeholder="Phone *" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
            <Input placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
            <Input placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
            <Input placeholder="District / City" value={newCustomer.district} onChange={(e) => setNewCustomer({ ...newCustomer, district: e.target.value })} />
          </div>
          <DialogFooter>
            <Button onClick={handleAddCustomer} disabled={!newCustomer.full_name || !newCustomer.phone}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lead Modal */}
      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🎯 Add Lead</DialogTitle>
          </DialogHeader>
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
            <Button onClick={handleAddLead} disabled={!newLead.name || !newLead.phone}>Add Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Follow-up Modal */}
      <Dialog open={showAddFollowup} onOpenChange={setShowAddFollowup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⏰ Schedule Follow-up</DialogTitle>
          </DialogHeader>
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
                  <Calendar
                    mode="single"
                    selected={newFollowup.date}
                    onSelect={(d) => setNewFollowup({ ...newFollowup, date: d })}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={newFollowup.time}
                onChange={(e) => setNewFollowup({ ...newFollowup, time: e.target.value })}
                className="w-28"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddFollowup} disabled={!newFollowup.phone || !newFollowup.note || !newFollowup.date}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk WhatsApp Modal */}
      <Dialog open={showBulkWhatsApp} onOpenChange={setShowBulkWhatsApp}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>💬 Bulk WhatsApp Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              placeholder="Type your message... Use {name}, {last_order}, {total_spent}"
              className="min-h-[100px]"
            />
            <div className="text-xs text-muted-foreground">
              Variables: <code>{"{name}"}</code> <code>{"{last_order}"}</code> <code>{"{total_spent}"}</code>
            </div>
            {selectedCustomers.length > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold mb-1">Preview (for {selectedCustomers[0].full_name}):</p>
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
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                selectedCustomers.forEach((c) => {
                  const msg = bulkMessage
                    .replace("{name}", c.full_name)
                    .replace("{last_order}", c.last_order_date ? format(new Date(c.last_order_date), "PP") : "N/A")
                    .replace("{total_spent}", `৳${(c.total_spent || 0).toLocaleString()}`);
                  window.open(`https://wa.me/880${c.phone.replace(/^0/, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                });
                setShowBulkWhatsApp(false);
              }}
            >
              Send to {selectedCustomers.length} customers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
