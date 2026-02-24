import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useChartOfAccounts, useGeneralLedger, usePeriodLocks, useLockPeriod } from "@/hooks/use-accounting";
import { formatBDT } from "@/lib/format";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const heading = { fontFamily: "'Playfair Display', serif" };
const mono = { fontFamily: "'DM Mono', monospace" };

export function GeneralLedgerTab() {
  const { data: accounts } = useChartOfAccounts();
  const [accountId, setAccountId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const { data: ledger, isLoading } = useGeneralLedger(accountId || null, dateFrom, dateTo);
  const { data: locks } = usePeriodLocks();
  const lockPeriod = useLockPeriod();
  const [lockOpen, setLockOpen] = useState(false);
  const [lockDate, setLockDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const selectedAccount = (accounts || []).find(a => a.id === accountId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={heading}>General Ledger</h3>
        <Button variant="outline" size="sm" onClick={() => setLockOpen(true)}>
          <Lock className="w-4 h-4 mr-1" /> Period Lock
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {(accounts || []).map(a =>
                <SelectItem key={a.id} value={a.id} className="text-xs">{a.code} — {a.name}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px] h-9 text-xs" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px] h-9 text-xs" />
        </div>
      </div>

      {accountId && (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="p-3 bg-muted/30 border-b border-border">
              <span className="font-semibold">{selectedAccount?.code} — {selectedAccount?.name}</span>
              <span className="text-xs text-muted-foreground ml-2 capitalize">({selectedAccount?.account_type})</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">JE #</th>
                  <th className="text-left p-3 font-semibold">Description</th>
                  <th className="text-right p-3 font-semibold">Debit</th>
                  <th className="text-right p-3 font-semibold">Credit</th>
                  <th className="text-right p-3 font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(ledger || []).map((line: any) => (
                  <tr key={line.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3">{line.journal_entries?.entry_date}</td>
                    <td className="p-3 font-mono text-xs" style={mono}>JE-{line.journal_entries?.entry_number}</td>
                    <td className="p-3 max-w-[250px] truncate">{line.journal_entries?.description}</td>
                    <td className="p-3 text-right font-mono" style={mono}>{line.debit > 0 ? formatBDT(line.debit) : ""}</td>
                    <td className="p-3 text-right font-mono" style={mono}>{line.credit > 0 ? formatBDT(line.credit) : ""}</td>
                    <td className={`p-3 text-right font-mono font-bold ${line.running_balance >= 0 ? "text-emerald-600" : "text-red-600"}`} style={mono}>
                      {formatBDT(Math.abs(line.running_balance))} {line.running_balance < 0 ? "Cr" : "Dr"}
                    </td>
                  </tr>
                ))}
                {(ledger || []).length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No entries found for this account</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {!accountId && (
        <Card className="border-border"><CardContent className="p-8 text-center text-muted-foreground">Select an account to view the ledger</CardContent></Card>
      )}

      {/* Period Lock */}
      {(locks || []).length > 0 && (
        <Card className="border-border">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-2">Locked Periods</h4>
            <div className="flex flex-wrap gap-2">
              {(locks || []).map((l: any) => (
                <div key={l.id} className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-800 rounded-md text-xs">
                  <Lock className="w-3 h-3" /> Up to {l.period_end}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader><DialogTitle style={heading}>Lock Period</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Lock all entries up to</Label><Input type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">⚠️ No journals can be posted to dates on or before this date after locking.</p>
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={() => { lockPeriod.mutate(lockDate); setLockOpen(false); }}>
              Lock Period
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
