import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  HardDrive, FileText, Users, Package, BarChart3, Database, Image,
  AlertTriangle, Bug, CheckCircle2, Clock, Plus, ChevronDown, ChevronUp,
  Server, Shield, ShoppingCart, Bell, Boxes, Wallet, Sparkles,
} from "lucide-react";

/* ── Types ── */
interface StorageModule {
  name: string;
  icon: React.ReactNode;
  tables: string[];
  records: number;
  sizeBytes: number;
}

interface SystemIssue {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  module: string | null;
  reported_at: string;
  reported_by: string | null;
}

/* ── Module definitions mapped to real tables ── */
const MODULE_DEFS: { name: string; icon: React.ReactNode; tables: string[] }[] = [
  { name: "Orders", icon: <ShoppingCart className="w-5 h-5" />, tables: ["orders", "order_items", "web_order_notes"] },
  { name: "Products", icon: <Package className="w-5 h-5" />, tables: ["products", "categories"] },
  { name: "Customers", icon: <Users className="w-5 h-5" />, tables: ["customers", "customer_qc_cache"] },
  { name: "Inventory", icon: <Boxes className="w-5 h-5" />, tables: ["inventory_movements", "damage_log", "returns"] },
  { name: "Accounting", icon: <Wallet className="w-5 h-5" />, tables: ["transactions", "accounts"] },
  { name: "HR & Staff", icon: <Users className="w-5 h-5" />, tables: ["staff", "roles", "attendance", "leaves", "payroll"] },
  { name: "Procurement", icon: <Database className="w-5 h-5" />, tables: ["purchase_orders", "purchase_order_items", "suppliers"] },
  { name: "System", icon: <Server className="w-5 h-5" />, tables: ["settings", "notifications", "ad_campaigns", "system_issues", "storage_metrics"] },
];

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/20 text-red-400 border-red-500/30" },
  high: { color: "text-orange-400", bg: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  low: { color: "text-slate-400", bg: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string }> = {
  open: { label: "Open", icon: <AlertTriangle className="w-3.5 h-3.5" />, bg: "bg-red-500/20 text-red-400 border-red-500/30" },
  in_progress: { label: "In Progress", icon: <Clock className="w-3.5 h-3.5" />, bg: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  resolved: { label: "Resolved", icon: <CheckCircle2 className="w-3.5 h-3.5" />, bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getUsagePct(used: number, cap: number) {
  return cap > 0 ? (used / cap) * 100 : 0;
}

function getProgressColor(pct: number) {
  if (pct > 85) return "bg-red-500";
  if (pct > 60) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function SystemHealth() {
  const [modules, setModules] = useState<StorageModule[]>([]);
  const [tableSizes, setTableSizes] = useState<Record<string, number>>({});
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [issues, setIssues] = useState<SystemIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({ title: "", description: "", severity: "medium", module: "", reported_by: "" });
  const [storageFiles, setStorageFiles] = useState<{ bucket: string; count: number }[]>([]);

  /* ── Fetch all real data ── */
  useEffect(() => {
    async function load() {
      // Fetch record counts from all tables
      const allTables = Array.from(new Set(MODULE_DEFS.flatMap(m => m.tables)));
      
      const countPromises = allTables.map(table =>
        supabase.from(table as any).select("*", { count: "exact", head: true }).then(r => ({ table, count: r.count || 0 }))
      );

      const countResults: Record<string, number> = {};
      const results = await Promise.all(countPromises);
      results.forEach(r => { countResults[r.table] = r.count; });
      setRecordCounts(countResults);

      // Issues
      const iRes = await supabase.from("system_issues").select("*").order("reported_at", { ascending: false });
      if (iRes.data) setIssues(iRes.data);

      setLoading(false);
    }
    load();

    // Realtime for issues
    const issuesChan = supabase.channel("system_issues_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_issues" }, (payload) => {
        supabase.from("system_issues").select("*").order("reported_at", { ascending: false }).then(r => { if (r.data) setIssues(r.data); });
        if (payload.eventType === "UPDATE") {
          const rec = payload.new as SystemIssue;
          toast({ title: "Issue Updated", description: `"${rec.title}" → ${rec.status}` });
        }
      }).subscribe();

    return () => { supabase.removeChannel(issuesChan); };
  }, []);

  /* ── Compute modules from record counts ── */
  const computedModules = useMemo(() => {
    return MODULE_DEFS.map(def => {
      const totalRecords = def.tables.reduce((s, t) => s + (recordCounts[t] || 0), 0);
      // Estimate size: ~500 bytes per record as a reasonable approximation
      const estimatedSize = totalRecords * 500;
      return {
        name: def.name,
        icon: def.icon,
        tables: def.tables,
        records: totalRecords,
        sizeBytes: estimatedSize,
      };
    });
  }, [recordCounts]);

  /* ── Computed totals ── */
  const totalRecords = computedModules.reduce((s, m) => s + m.records, 0);
  const totalSizeBytes = computedModules.reduce((s, m) => s + m.sizeBytes, 0);
  const dbCapacity = 500 * 1024 * 1024; // 500 MB Supabase free tier
  const usedPct = getUsagePct(totalSizeBytes, dbCapacity);

  const donutData = [
    { name: "Used", value: totalSizeBytes },
    { name: "Free", value: Math.max(0, dbCapacity - totalSizeBytes) },
  ];

  const barData = computedModules
    .filter(m => m.records > 0)
    .sort((a, b) => b.records - a.records)
    .map(m => ({ name: m.name, records: m.records, size: +(m.sizeBytes / 1024).toFixed(1) }));

  const criticalCount = issues.filter(i => i.severity === "critical" && i.status !== "resolved").length;
  const highCount = issues.filter(i => i.severity === "high" && i.status !== "resolved").length;
  const resolvedCount = issues.filter(i => i.status === "resolved").length;

  const filteredIssues = issues.filter(i => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (severityFilter !== "all" && i.severity !== severityFilter) return false;
    return true;
  });

  /* ── Actions ── */
  async function fixWithAI(issue: SystemIssue) {
    const prompt = `Please fix this bug in our ERP system:\n\nModule: ${issue.module || "N/A"}\nSeverity: ${issue.severity}\nTitle: ${issue.title}\nDescription: ${issue.description || "No description"}\n\nFind the relevant code and fix it.`;
    await navigator.clipboard.writeText(prompt);
    await supabase.from("system_issues").update({ status: "in_progress" }).eq("id", issue.id);
    toast({ title: "Prompt Copied!", description: "Paste it into Lovable chat to start fixing." });
  }

  async function markResolved(id: string) {
    await supabase.from("system_issues").update({ status: "resolved" }).eq("id", id);
  }

  async function submitNewIssue() {
    if (!newIssue.title) return;
    await supabase.from("system_issues").insert({
      title: newIssue.title,
      description: newIssue.description || null,
      severity: newIssue.severity,
      module: newIssue.module || null,
      reported_by: newIssue.reported_by || null,
    });
    setNewIssue({ title: "", description: "", severity: "medium", module: "", reported_by: "" });
    setNewIssueOpen(false);
    toast({ title: "Issue Reported", description: "New issue has been submitted." });
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20">
            <Server className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Health & Storage</h1>
            <p className="text-sm text-slate-500">Live data from your ERP database</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 gap-1.5">
            <Shield className="w-3.5 h-3.5" /> {totalRecords.toLocaleString()} Records
          </Badge>
        </div>
      </div>

      {/* ── TOP: Storage Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <Card className="bg-[#111827] border-slate-700/50 col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-300 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" /> Database Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="w-48 h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={0}>
                    <Cell fill="#06b6d4" />
                    <Cell fill="#1e293b" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-cyan-400">{usedPct.toFixed(1)}%</span>
                <span className="text-xs text-slate-500">Used</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
              <span className="text-cyan-400 font-semibold">{formatBytes(totalSizeBytes)} Used</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{formatBytes(dbCapacity - totalSizeBytes)} Free</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{formatBytes(dbCapacity)} Total</span>
            </div>
          </CardContent>
        </Card>

        {/* Module Cards */}
        <div className="col-span-1 lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {computedModules.map(m => {
            const moduleCap = dbCapacity / computedModules.length;
            const pct = getUsagePct(m.sizeBytes, moduleCap);
            return (
              <Card key={m.name} className="bg-[#111827] border-slate-700/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-cyan-400">{m.icon}</span>
                    <span className="font-medium text-sm">{m.name}</span>
                  </div>
                  <div className="text-lg font-bold text-slate-100">{m.records.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">records · {formatBytes(m.sizeBytes)}</div>
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getProgressColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="text-xs text-slate-500">
                    {m.tables.length} table{m.tables.length > 1 ? "s" : ""}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── MID: Bar Chart ── */}
      <Card className="bg-[#111827] border-slate-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-300 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" /> Records by Module
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} width={100} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
                formatter={(value: number, name: string) => [name === "records" ? `${value} records` : `${value} KB`, name === "records" ? "Records" : "Est. Size"]}
              />
              <Bar dataKey="records" fill="#06b6d4" name="Records" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Table Details ── */}
      <Card className="bg-[#111827] border-slate-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-300 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" /> Table-Level Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Object.entries(recordCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([table, count]) => (
                <div key={table} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="text-xs text-slate-500 truncate">{table}</div>
                  <div className="text-lg font-bold text-slate-200">{count.toLocaleString()}</div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* ── BOTTOM: Issues Tracker ── */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-200">Issues & Bugs Tracker</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-red-400 font-semibold">🔴 {criticalCount} Critical</span>
            <span className="text-orange-400 font-semibold">🟡 {highCount} High</span>
            <span className="text-emerald-400 font-semibold">🟢 {resolvedCount} Resolved</span>
          </div>
        </div>

        {/* Filters + Add */}
        <div className="flex flex-wrap items-center gap-3">
          {["all", "open", "in_progress", "resolved"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              className={statusFilter === s ? "bg-cyan-600 hover:bg-cyan-700 text-white border-none" : "border-slate-600 text-slate-300 hover:bg-slate-700"}
              onClick={() => setStatusFilter(s)}>
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
            </Button>
          ))}
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36 bg-[#111827] border-slate-600 text-slate-300 h-9">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-[#111827] border-slate-600 text-slate-300">
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={newIssueOpen} onOpenChange={setNewIssueOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white ml-auto gap-1.5">
                <Plus className="w-4 h-4" /> Report Issue
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111827] border-slate-700 text-slate-200 max-w-md">
              <DialogHeader><DialogTitle>Report New Issue</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-400">Title *</Label>
                  <Input value={newIssue.title} onChange={e => setNewIssue(p => ({ ...p, title: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-slate-200" placeholder="Describe the issue..." />
                </div>
                <div>
                  <Label className="text-slate-400">Description</Label>
                  <Textarea value={newIssue.description} onChange={e => setNewIssue(p => ({ ...p, description: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-slate-200" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-400">Severity</Label>
                    <Select value={newIssue.severity} onValueChange={v => setNewIssue(p => ({ ...p, severity: v }))}>
                      <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#111827] border-slate-600 text-slate-300">
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-400">Module</Label>
                    <Input value={newIssue.module} onChange={e => setNewIssue(p => ({ ...p, module: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-slate-200" placeholder="e.g. Invoices" />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-400">Reported By</Label>
                  <Input value={newIssue.reported_by} onChange={e => setNewIssue(p => ({ ...p, reported_by: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-slate-200" placeholder="Your name" />
                </div>
                <Button onClick={submitNewIssue} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">Submit Issue</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Issues List */}
        <div className="space-y-2">
          {filteredIssues.length === 0 && (
            <div className="text-center py-12 text-slate-500">No issues match the current filters.</div>
          )}
          {filteredIssues.map(issue => {
            const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
            const stat = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
            const expanded = expandedIssue === issue.id;
            return (
              <Card key={issue.id} className="bg-[#111827] border-slate-700/50 hover:border-slate-600/70 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpandedIssue(expanded ? null : issue.id)}>
                    <div className="mt-0.5">
                      {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-200 text-sm">{issue.title}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${sev.bg}`}>{issue.severity}</Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 border gap-1 ${stat.bg}`}>{stat.icon}{stat.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {issue.module && <span>{issue.module}</span>}
                        <span>{new Date(issue.reported_at).toLocaleDateString()}</span>
                        {issue.reported_by && <span>by {issue.reported_by}</span>}
                      </div>
                    </div>
                    {issue.status !== "resolved" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="sm" variant="outline"
                          className="border-cyan-600/50 text-cyan-400 hover:bg-cyan-500/20 text-xs gap-1"
                          onClick={e => { e.stopPropagation(); fixWithAI(issue); }}>
                          <Sparkles className="w-3 h-3" /> Fix with AI
                        </Button>
                        <Button size="sm" variant="outline"
                          className="border-emerald-600/50 text-emerald-400 hover:bg-emerald-500/20 text-xs"
                          onClick={e => { e.stopPropagation(); markResolved(issue.id); }}>
                          Mark Resolved
                        </Button>
                      </div>
                    )}
                  </div>
                  {expanded && issue.description && (
                    <div className="mt-3 ml-7 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                      {issue.description}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0B1120] p-6 space-y-6">
      <Skeleton className="h-10 w-72 bg-slate-800" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-64 bg-slate-800 rounded-xl" />
        <div className="col-span-2 grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 bg-slate-800 rounded-xl" />)}
        </div>
      </div>
      <Skeleton className="h-64 bg-slate-800 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 bg-slate-800 rounded-xl" />)}
      </div>
    </div>
  );
}
