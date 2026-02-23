import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ArrowUpRight, ArrowDownLeft, Plus, RefreshCw } from "lucide-react";
import { formatBDT } from "@/lib/format";

export default function AccountsPage() {
  const { data: balances, isLoading } = useQuery({
    queryKey: ["account-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_account_balances" as any)
        .select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: recentLedger } = useQuery({
    queryKey: ["recent-ledger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_ledger")
        .select("*, accounts:account_id(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const totalLiquid = (balances || [])
    .filter((b: any) => ["cash", "bank", "wallet"].includes(b.type))
    .reduce((s: number, b: any) => s + (b.balance || 0), 0);

  const totalReceivable = (balances || [])
    .filter((b: any) => b.type === "receivable")
    .reduce((s: number, b: any) => s + (b.balance || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Accounts Ledger</h1>
            <p className="text-sm text-muted-foreground">Source of truth for all money movement</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> Transfer
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" /> Record Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Liquid</p>
            <p className="text-2xl font-bold text-foreground mt-1">{isLoading ? <Skeleton className="h-8 w-32" /> : formatBDT(totalLiquid)}</p>
            <p className="text-xs text-muted-foreground mt-1">Cash + Bank + Wallets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Courier Receivable</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{isLoading ? <Skeleton className="h-8 w-32" /> : formatBDT(totalReceivable)}</p>
            <p className="text-xs text-muted-foreground mt-1">COD due from couriers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-2xl font-bold text-foreground mt-1">{isLoading ? <Skeleton className="h-8 w-32" /> : formatBDT(totalLiquid + totalReceivable)}</p>
            <p className="text-xs text-muted-foreground mt-1">Liquid + Receivable</p>
          </CardContent>
        </Card>
      </div>

      {/* Account Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px]" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total In</TableHead>
                  <TableHead className="text-right">Total Out</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(balances || []).map((acc: any) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{acc.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-mono text-sm">{formatBDT(acc.total_in)}</TableCell>
                    <TableCell className="text-right text-red-600 font-mono text-sm">{formatBDT(acc.total_out)}</TableCell>
                    <TableCell className="text-right font-bold font-mono text-sm">{formatBDT(acc.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Ledger Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Ledger Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentLedger || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No ledger entries yet. Entries are created automatically from orders, settlements, and expenses.
                  </TableCell>
                </TableRow>
              ) : (
                (recentLedger || []).map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{entry.ledger_date}</TableCell>
                    <TableCell className="text-sm font-medium">{entry.accounts?.name}</TableCell>
                    <TableCell>
                      {entry.direction === "in" ? (
                        <Badge className="bg-green-100 text-green-700 text-xs"><ArrowDownLeft className="w-3 h-3 mr-1" />IN</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 text-xs"><ArrowUpRight className="w-3 h-3 mr-1" />OUT</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatBDT(entry.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.ref_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entry.note}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
