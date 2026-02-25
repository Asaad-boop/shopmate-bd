import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatBDT2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  Download, CheckCircle2, AlertTriangle, ExternalLink,
  Landmark, Wallet, Building2, PiggyBank, Package, Truck,
  ChevronRight, Printer, Shield,
} from "lucide-react";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

// ─── Hook ─────────────────────────────────────────────────────
function useBalanceSnapshot(asOfDate: string, includeZero: boolean) {
  return useQuery({
    queryKey: ["balance-snapshot-report", asOfDate, includeZero],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("balance_snapshot_report", {
        p_as_of_date: asOfDate,
        p_include_zero: includeZero,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return parsed as {
        as_of_date: string;
        assets: { items: any[]; total: number };
        liabilities: { items: any[]; total: number };
        equity: { items: any[]; accounts_total: number; retained_earnings: number; total: number };
        reconciliation: {
          total_assets: number;
          total_liabilities: number;
          total_equity: number;
          is_balanced: boolean;
          variance: number;
          inventory_ledger_value: number;
          inventory_gl_value: number;
          inventory_reconciled: boolean;
          cash_gl_total: number;
        };
      };
    },
    staleTime: 60_000,
  });
}

// ─── Helpers ──────────────────────────────────────────────────
function exportCSV(data: any) {
  if (!data) return;
  const lines: string[] = ["Section,Code,Account,Balance"];
  const addSection = (section: string, items: any[]) => {
    (items || []).forEach((i: any) => {
      lines.push(`"${section}","${i.code}","${i.name}","${Number(i.balance).toFixed(2)}"`);
    });
  };
  addSection("Assets", data.assets.items);
  addSection("Liabilities", data.liabilities.items);
  addSection("Equity", data.equity.items);
  lines.push(`"Equity","","Retained Earnings","${Number(data.equity.retained_earnings).toFixed(2)}"`);
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `balance-snapshot-${data.as_of_date}.csv`;
  a.click();
}

const ACCOUNT_LINKS: Record<string, string> = {
  "1100": "/finance/ledger",
  "1110": "/finance/ledger",
  "1120": "/finance/ledger",
  "1130": "/finance/ledger",
  "1200": "/finance/settlements",
  "1300": "/reports/inventory-valuation",
  "2100": "/finance/payables",
  "2200": "/finance/posting",
};

function getLinkForCode(code: string): string | null {
  for (const prefix of Object.keys(ACCOUNT_LINKS)) {
    if (code.startsWith(prefix)) return ACCOUNT_LINKS[prefix];
  }
  return null;
}

const ACCOUNT_ICONS: Record<string, React.ReactNode> = {
  "1100": <Wallet className="w-3.5 h-3.5" />,
  "1110": <Building2 className="w-3.5 h-3.5" />,
  "1120": <Wallet className="w-3.5 h-3.5" />,
  "1130": <Wallet className="w-3.5 h-3.5" />,
  "1200": <Truck className="w-3.5 h-3.5" />,
  "1300": <Package className="w-3.5 h-3.5" />,
  "2100": <Landmark className="w-3.5 h-3.5" />,
  "2200": <PiggyBank className="w-3.5 h-3.5" />,
};

function getIconForCode(code: string): React.ReactNode {
  for (const prefix of Object.keys(ACCOUNT_ICONS)) {
    if (code.startsWith(prefix)) return ACCOUNT_ICONS[prefix];
  }
  return <Landmark className="w-3.5 h-3.5" />;
}

// ─── Section Component ────────────────────────────────────────
function BalanceSection({
  title,
  items,
  total,
  colorClass,
}: {
  title: string;
  items: any[];
  total: number;
  colorClass: string;
}) {
  return (
    <div>
      <h3 className={cn("text-sm font-bold uppercase tracking-wider mb-3", colorClass)} style={heading}>
        {title}
      </h3>
      <div className="space-y-1">
        {(items || []).map((item: any) => {
          const link = getLinkForCode(item.code);
          const icon = getIconForCode(item.code);
          return (
            <div
              key={item.code}
              className={cn(
                "flex items-center justify-between py-2 px-3 rounded-lg transition-colors",
                link ? "hover:bg-accent cursor-pointer group" : ""
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-muted-foreground">{icon}</span>
                <span className="text-xs font-mono text-muted-foreground w-10">{item.code}</span>
                <span className="text-sm">{item.name}</span>
                {link && (
                  <Link to={link} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-3.5 h-3.5 text-primary" />
                  </Link>
                )}
              </div>
              <span className={cn("text-sm font-semibold", Number(item.balance) < 0 && "text-destructive")} style={mono}>
                {formatBDT2(item.balance)}
              </span>
            </div>
          );
        })}
      </div>
      <Separator className="my-2" />
      <div className="flex items-center justify-between py-2 px-3">
        <span className={cn("text-sm font-bold", colorClass)}>Total {title}</span>
        <span className={cn("text-base font-bold", colorClass)} style={mono}>
          {formatBDT2(total)}
        </span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function ReportsBalance() {
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [includeZero, setIncludeZero] = useState(false);

  const { data, isLoading } = useBalanceSnapshot(asOfDate, includeZero);

  const recon = data?.reconciliation;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" style={heading}>Balance Snapshot</h1>
          <p className="text-sm text-muted-foreground">
            Financial position as of {asOfDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => data && exportCSV(data)}>
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1" /> Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs">As of Date</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-[160px] h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={includeZero} onCheckedChange={setIncludeZero} id="inc-zero" />
            <Label htmlFor="inc-zero" className="text-xs">Include zero balances</Label>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[200px]" />
        </div>
      ) : data ? (
        <>
          {/* Reconciliation Panel */}
          <Card className={cn(
            "border-2",
            recon?.is_balanced ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {recon?.is_balanced ? (
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1 space-y-3">
                  <div>
                    <p className={cn("text-sm font-semibold", recon?.is_balanced ? "text-success" : "text-destructive")}>
                      {recon?.is_balanced ? "Balance Sheet Reconciled" : "Balance Sheet Mismatch"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Assets = Liabilities + Equity
                    </p>
                  </div>

                  {/* Equation */}
                  <div className="flex flex-wrap gap-4 items-center text-sm">
                    <div className="text-center">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Assets</p>
                      <p className="font-bold text-primary" style={mono}>{formatBDT2(recon?.total_assets)}</p>
                    </div>
                    <span className="text-muted-foreground font-bold">=</span>
                    <div className="text-center">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Liabilities</p>
                      <p className="font-bold" style={mono}>{formatBDT2(recon?.total_liabilities)}</p>
                    </div>
                    <span className="text-muted-foreground font-bold">+</span>
                    <div className="text-center">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Equity</p>
                      <p className="font-bold" style={mono}>{formatBDT2(recon?.total_equity)}</p>
                    </div>
                    {!recon?.is_balanced && (
                      <>
                        <span className="text-destructive font-bold">≠</span>
                        <div className="text-center">
                          <p className="text-[10px] uppercase text-destructive tracking-wider">Variance</p>
                          <p className="font-bold text-destructive" style={mono}>{formatBDT2(recon?.variance)}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Sub-checks */}
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      {recon?.inventory_reconciled ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <span>Inventory GL vs Ledger</span>
                      {!recon?.inventory_reconciled && (
                        <span className="text-destructive font-mono">
                          (GL: {formatBDT2(recon?.inventory_gl_value)} vs Ledger: {formatBDT2(recon?.inventory_ledger_value)})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      <span>Cash accounts match GL: {formatBDT2(recon?.cash_gl_total)}</span>
                    </div>
                  </div>

                  {!recon?.is_balanced && (
                    <Link to="/exceptions" className="text-xs text-primary font-medium inline-flex items-center gap-1">
                      View in Exceptions Center <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance Sheet */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Assets */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2" style={heading}>
                  <Shield className="w-4 h-4 text-primary" /> Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BalanceSection
                  title="Assets"
                  items={data.assets.items || []}
                  total={data.assets.total}
                  colorClass="text-primary"
                />
              </CardContent>
            </Card>

            {/* Liabilities + Equity */}
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2" style={heading}>
                    <Landmark className="w-4 h-4 text-destructive" /> Liabilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BalanceSection
                    title="Liabilities"
                    items={data.liabilities.items || []}
                    total={data.liabilities.total}
                    colorClass="text-destructive"
                  />
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2" style={heading}>
                    <PiggyBank className="w-4 h-4 text-success" /> Equity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-success" style={heading}>
                      Equity
                    </h3>
                    <div className="space-y-1">
                      {(data.equity.items || []).map((item: any) => (
                        <div key={item.code} className="flex items-center justify-between py-2 px-3 rounded-lg">
                          <div className="flex items-center gap-2.5">
                            <PiggyBank className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-mono text-muted-foreground w-10">{item.code}</span>
                            <span className="text-sm">{item.name}</span>
                          </div>
                          <span className="text-sm font-semibold" style={mono}>{formatBDT2(item.balance)}</span>
                        </div>
                      ))}
                      {/* Retained Earnings (calculated) */}
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/50">
                        <div className="flex items-center gap-2.5">
                          <PiggyBank className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-mono text-muted-foreground w-10">—</span>
                          <span className="text-sm italic">Retained Earnings (calculated)</span>
                        </div>
                        <span className={cn("text-sm font-semibold", data.equity.retained_earnings < 0 && "text-destructive")} style={mono}>
                          {formatBDT2(data.equity.retained_earnings)}
                        </span>
                      </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between py-2 px-3">
                      <span className="text-sm font-bold text-success">Total Equity</span>
                      <span className="text-base font-bold text-success" style={mono}>
                        {formatBDT2(data.equity.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Grand Totals */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Total Assets</p>
                  <p className="text-2xl font-bold text-primary" style={mono}>{formatBDT2(data.assets.total)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Total Liabilities + Equity</p>
                  <p className="text-2xl font-bold" style={mono}>
                    {formatBDT2((data.liabilities.total || 0) + (data.equity.total || 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
