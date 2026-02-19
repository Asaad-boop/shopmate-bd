import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/format";
import { CheckCircle, Loader2, Banknote, TrendingUp } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CODGroup {
  courier: string;
  orderIds: string[];
  totalAmount: number;
  orderCount: number;
}

export function CODReconciliation({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);

  // Fetch delivered orders with COD that are not yet paid
  const { data: codOrders, isLoading } = useQuery({
    queryKey: ["cod-reconciliation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total_amount, pathao_consignment_id, courier_status, payment_status, payment_method, order_date")
        .eq("status", "delivered")
        .neq("payment_status", "paid")
        .order("order_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Group by courier
  const groups: CODGroup[] = (() => {
    if (!codOrders) return [];
    const pathaoOrders = codOrders.filter((o) => o.pathao_consignment_id);
    const otherOrders = codOrders.filter((o) => !o.pathao_consignment_id);

    const result: CODGroup[] = [];
    if (pathaoOrders.length > 0) {
      result.push({
        courier: "Pathao",
        orderIds: pathaoOrders.map((o) => o.id),
        totalAmount: pathaoOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
        orderCount: pathaoOrders.length,
      });
    }
    if (otherOrders.length > 0) {
      result.push({
        courier: "Other / Direct",
        orderIds: otherOrders.map((o) => o.id),
        totalAmount: otherOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
        orderCount: otherOrders.length,
      });
    }
    return result;
  })();

  const totalPending = groups.reduce((s, g) => s + g.totalAmount, 0);

  const handleMarkReceived = async (group: CODGroup) => {
    setProcessing(group.courier);
    try {
      // Update all orders to paid
      await supabase
        .from("orders")
        .update({ payment_status: "paid", updated_at: new Date().toISOString() })
        .in("id", group.orderIds);

      // Insert transaction record
      await supabase.from("transactions").insert({
        type: "income",
        category: "cod_collection",
        amount: group.totalAmount,
        description: `${group.courier} COD — ${group.orderCount} orders`,
        transaction_date: new Date().toISOString().slice(0, 10),
      });

      queryClient.invalidateQueries({ queryKey: ["cod-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["orders-full"] });

      toast({
        title: "✅ COD reconciliation সম্পন্ন",
        description: `${group.courier}: ${formatBDT(group.totalAmount)} (${group.orderCount} orders)`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setProcessing(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5" />
            COD Reconciliation
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Summary Cards */}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <Card key={group.courier}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{group.courier}</span>
                        <Badge variant="secondary" className="text-xs">
                          {group.orderCount} orders
                        </Badge>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {formatBDT(group.totalAmount)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => handleMarkReceived(group)}
                      disabled={processing === group.courier}
                    >
                      {processing === group.courier ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      )}
                      Mark All Received
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* Total */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Total Pending COD</span>
                  </div>
                  <span className="text-xl font-bold">{formatBDT(totalPending)}</span>
                </CardContent>
              </Card>

              {groups.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  কোন pending COD নেই! 🎉
                </p>
              )}

              {/* Order list */}
              {codOrders && codOrders.length > 0 && (
                <div className="rounded-lg border">
                  <div className="px-3 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
                    Pending Orders ({codOrders.length})
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Order #</TableHead>
                        <TableHead className="text-xs">Amount</TableHead>
                        <TableHead className="text-xs">Courier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codOrders.slice(0, 50).map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="text-xs font-mono">{o.order_number}</TableCell>
                          <TableCell className="text-xs font-medium">{formatBDT(o.total_amount)}</TableCell>
                          <TableCell className="text-xs">
                            {o.pathao_consignment_id ? "Pathao" : "Direct"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
