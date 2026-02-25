import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFinanceCashPosition,
  useFinanceWorkingCapital,
  useFinancePostingQueue,
  useFinanceSettlementSummary,
  useFinanceAlerts,
} from "@/hooks/use-finance-dashboard";
import { formatBDT } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Banknote, Building2, Smartphone, Wallet, DollarSign,
  Package, Truck, Users, CreditCard,
  ClipboardList, AlertTriangle, RefreshCw,
  BookOpen, FileCheck, Receipt, CalendarCheck, Lock,
  ArrowRight, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ── tiny metric card ─────────────────────────────── */
function MetricCard({
  label, value, icon: Icon, loading, accent, onClick, sub,
}: {
  label: string; value: string | number; icon: any; loading?: boolean;
  accent?: string; onClick?: () => void; sub?: string;
}) {
  if (loading) return <Skeleton className="h-[110px] rounded-xl" />;
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-xl p-4 text-left transition-all hover:shadow-md hover:border-primary/30 group",
        onClick && "cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("p-1.5 rounded-lg", accent || "bg-primary/10 text-primary")}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground">{typeof value === "number" ? formatBDT(value) : value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      {onClick && (
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
      )}
    </button>
  );
}

/* ── count card (for posting queue / settlements) ─── */
function CountCard({
  label, count, loading, onClick, variant,
}: {
  label: string; count: number; loading?: boolean; onClick?: () => void;
  variant?: "warning" | "destructive" | "default";
}) {
  if (loading) return <Skeleton className="h-[72px] rounded-lg" />;
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-lg px-4 py-3 text-left hover:shadow-sm hover:border-primary/20 transition-all flex items-center justify-between gap-3 group"
    >
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{count}</p>
      </div>
      {count > 0 && (
        <Badge variant={variant === "destructive" ? "destructive" : variant === "warning" ? "outline" : "secondary"} className="text-[10px]">
          {count}
        </Badge>
      )}
    </button>
  );
}

/* ── alert row ───────────────────────────────────── */
function AlertRow({ label, count, onClick }: { label: string; count: number; onClick?: () => void }) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <Badge variant="destructive" className="text-[10px]">{count}</Badge>
    </button>
  );
}

/* ── nav tile ─────────────────────────────────────── */
const NAV_TILES = [
  { label: "Accounts", icon: Building2, path: "/finance/accounts", desc: "Chart of accounts & balances" },
  { label: "Posting Queue", icon: ClipboardList, path: "/finance/posting-queue", desc: "Review pending journal entries" },
  { label: "Settlements", icon: FileCheck, path: "/finance/settlements", desc: "Courier statement processing" },
  { label: "Payables", icon: CreditCard, path: "/finance/payables", desc: "Supplier payables & aging" },
  { label: "Ledger", icon: BookOpen, path: "/accounting", desc: "General ledger & trial balance" },
  { label: "Period Close", icon: Lock, path: "/accounting", desc: "Close accounting periods" },
];

/* ── main page ────────────────────────────────────── */
export default function FinancePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const cash = useFinanceCashPosition();
  const wc = useFinanceWorkingCapital();
  const pq = useFinancePostingQueue();
  const ss = useFinanceSettlementSummary();
  const alerts = useFinanceAlerts();

  const totalLiquid = (cash.data?.cash ?? 0) + (cash.data?.bank ?? 0) + (cash.data?.bkash ?? 0) + (cash.data?.nagad ?? 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["finance-cash-position"] });
    qc.invalidateQueries({ queryKey: ["finance-working-capital"] });
    qc.invalidateQueries({ queryKey: ["finance-posting-queue"] });
    qc.invalidateQueries({ queryKey: ["finance-settlement-summary"] });
    qc.invalidateQueries({ queryKey: ["finance-alerts"] });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 h-14 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Finance Control Tower</h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">Ledger-backed real-time view</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* ─── 1. Cash Position ───────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Cash Position</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard label="Cash" value={cash.data?.cash ?? 0} icon={Banknote} loading={cash.isLoading} accent="bg-success/10 text-success" />
            <MetricCard label="Bank" value={cash.data?.bank ?? 0} icon={Building2} loading={cash.isLoading} accent="bg-info/10 text-info" />
            <MetricCard label="bKash" value={cash.data?.bkash ?? 0} icon={Smartphone} loading={cash.isLoading} accent="bg-[hsl(330,70%,92%)] text-[hsl(330,70%,40%)]" />
            <MetricCard label="Nagad" value={cash.data?.nagad ?? 0} icon={Wallet} loading={cash.isLoading} accent="bg-warning/10 text-warning" />
            <MetricCard label="Total Liquid Cash" value={totalLiquid} icon={DollarSign} loading={cash.isLoading} accent="bg-primary/10 text-primary" sub="Sum of all accounts" />
          </div>
        </section>

        {/* ─── 2. Working Capital ─────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Working Capital</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Inventory Value" value={wc.data?.inventory_value ?? 0} icon={Package} loading={wc.isLoading} />
            <MetricCard label="Courier Receivable" value={wc.data?.courier_receivable ?? 0} icon={Truck} loading={wc.isLoading} sub="Delivered, not settled" />
            <MetricCard label="Supplier Payables" value={wc.data?.supplier_payable ?? 0} icon={Users} loading={wc.isLoading} sub="Outstanding dues" />
            <MetricCard label="Customer Advance Liability" value={wc.data?.customer_advances ?? 0} icon={CreditCard} loading={wc.isLoading} sub="Undelivered advance orders" />
          </div>
        </section>

        {/* ─── 3 & 4: Posting Queue + Settlement ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Posting Queue */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" /> Posting Queue
              </h2>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => nav("/finance/posting-queue")}>
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CountCard label="Pending Advances" count={pq.data?.pending_advances ?? 0} loading={pq.isLoading} onClick={() => nav("/finance/posting-queue")} variant="warning" />
              <CountCard label="Pending Delivered" count={pq.data?.pending_delivered ?? 0} loading={pq.isLoading} onClick={() => nav("/finance/posting-queue")} />
              <CountCard label="Pending Settlements" count={pq.data?.pending_settlements ?? 0} loading={pq.isLoading} onClick={() => nav("/finance/posting-queue")} variant="warning" />
              <CountCard label="Pending Expenses" count={pq.data?.pending_expenses ?? 0} loading={pq.isLoading} onClick={() => nav("/finance/posting-queue")} />
            </div>
          </section>

          {/* Settlement Summary */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" /> Settlement Summary
                <Badge variant="secondary" className="text-[10px]">This Week</Badge>
              </h2>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => nav("/courier-cod")}>
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CountCard label="Statements Uploaded" count={ss.data?.statements_this_week ?? 0} loading={ss.isLoading} onClick={() => nav("/courier-cod")} />
              <CountCard label="Orders Matched" count={ss.data?.orders_matched ?? 0} loading={ss.isLoading} onClick={() => nav("/courier-cod")} />
              <CountCard label="Orders Posted" count={ss.data?.orders_posted ?? 0} loading={ss.isLoading} onClick={() => nav("/courier-cod")} />
              <CountCard label="Mismatches" count={ss.data?.mismatch_count ?? 0} loading={ss.isLoading} onClick={() => nav("/courier-cod")} variant="destructive" />
            </div>
          </section>
        </div>

        {/* ─── 5. Alerts ──────────────────────────── */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" /> Finance Alerts
          </h2>
          {alerts.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="space-y-1">
              <AlertRow label="Settlements pending > 5 days" count={alerts.data?.settlement_pending_5d ?? 0} onClick={() => nav("/courier-cod")} />
              <AlertRow label="Duplicate posting prevented" count={alerts.data?.duplicate_posting_blocked ?? 0} />
              <AlertRow label="Unmapped payment method accounts" count={alerts.data?.unmapped_methods ?? 0} onClick={() => nav("/accounting")} />
              <AlertRow label="Negative stock impacting finance" count={alerts.data?.negative_stock_finance ?? 0} onClick={() => nav("/inventory")} />
              {(alerts.data?.settlement_pending_5d ?? 0) === 0 &&
               (alerts.data?.duplicate_posting_blocked ?? 0) === 0 &&
               (alerts.data?.unmapped_methods ?? 0) === 0 &&
               (alerts.data?.negative_stock_finance ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground py-2 text-center">✅ No active alerts</p>
              )}
            </div>
          )}
        </section>

        {/* ─── 6. Navigation Tiles ────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Finance Modules</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {NAV_TILES.map((t) => (
              <button
                key={t.label}
                onClick={() => nav(t.path)}
                className="bg-card border border-border rounded-xl p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary w-fit mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <t.icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
