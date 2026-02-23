import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Plus } from "lucide-react";
import { formatBDT } from "@/lib/format";

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("type", "expense")
        .order("transaction_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const totalExpenses = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Expenses</h1>
            <p className="text-sm text-muted-foreground">Track all business expenses with account ledger posting</p>
          </div>
        </div>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Expense</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {["ads", "salary", "rent", "other"].map((cat) => {
          const catTotal = (expenses || []).filter((e) => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0);
          return (
            <Card key={cat}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground capitalize">{cat}</p>
                <p className="text-xl font-bold text-foreground mt-1 font-mono">{formatBDT(catTotal)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[300px]" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(expenses || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No expenses recorded</TableCell>
                  </TableRow>
                ) : (
                  (expenses || []).map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">{exp.transaction_date}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-xs">{exp.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">{formatBDT(exp.amount)}</TableCell>
                      <TableCell className="text-sm capitalize">{exp.payment_method || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{exp.description || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
