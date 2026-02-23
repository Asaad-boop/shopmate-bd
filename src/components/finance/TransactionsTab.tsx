import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTransactions, useDeleteTransaction, CATEGORY_LABELS } from "@/hooks/use-finance";
import { formatBDT, formatDate } from "@/lib/format";
import { Search, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const mono = { fontFamily: "'DM Mono', monospace" };

export function TransactionsTab() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [account, setAccount] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useTransactions({ search, type, account, page, pageSize });
  const deleteTxn = useDeleteTransaction();

  const totalPages = Math.ceil((data?.count || 0) / pageSize);

  const exportCSV = () => {
    if (!data?.data?.length) return;
    const headers = ["Date", "Description", "Category", "Type", "Payment Method", "Amount"];
    const rows = data.data.map(t => [t.transaction_date, t.description || "", t.category || "", t.type, t.payment_method || "", t.amount]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "transactions.csv"; a.click();
  };

  return (
    <Card className="border-[#e4e6ef]">
      <CardContent className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search transactions..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(0); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={account} onValueChange={(v) => { setAccount(v); setPage(0); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              <SelectItem value="bkash">bKash</SelectItem>
              <SelectItem value="nagad">Nagad</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-[#e4e6ef] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#0f172a]">
                <TableHead className="text-white text-xs">Date</TableHead>
                <TableHead className="text-white text-xs">Description</TableHead>
                <TableHead className="text-white text-xs">Category</TableHead>
                <TableHead className="text-white text-xs">Type</TableHead>
                <TableHead className="text-white text-xs">Account</TableHead>
                <TableHead className="text-white text-xs text-right">Amount</TableHead>
                <TableHead className="text-white text-xs w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (data?.data || []).map((t) => (
                <TableRow key={t.id} className="hover:bg-[#f4f5f9]">
                  <TableCell className="text-xs" style={mono}>{formatDate(t.transaction_date)}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{t.description || "-"}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{CATEGORY_LABELS[t.category || ""] || t.category}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {t.type === "income" ? "Income" : "Expense"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{t.payment_method || "-"}</TableCell>
                  <TableCell className={`text-sm text-right font-semibold ${t.type === "income" ? "text-emerald-600" : "text-red-600"}`} style={mono}>
                    {t.type === "income" ? "+" : "−"}{formatBDT(Number(t.amount))}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTxn.mutate(t.id)} className="bg-red-600">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (data?.data || []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transactions found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{data?.count || 0} total transactions</span>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs">{page + 1} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
