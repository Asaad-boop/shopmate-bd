import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Upload, FileText } from "lucide-react";
import { formatBDT } from "@/lib/format";

export default function CourierCODPage() {
  const { data: shipments, isLoading } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: settlements } = useQuery({
    queryKey: ["cod-settlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cod_settlements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Courier & COD</h1>
            <p className="text-sm text-muted-foreground">Shipment tracking & COD reconciliation</p>
          </div>
        </div>
        <Button size="sm"><Upload className="w-4 h-4 mr-1" /> Import Settlement</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Shipments</p>
            <p className="text-2xl font-bold text-foreground">{(shipments || []).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Delivery</p>
            <p className="text-2xl font-bold text-orange-600">{(shipments || []).filter((s: any) => s.courier_status !== "delivered").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Settlements</p>
            <p className="text-2xl font-bold text-foreground">{(settlements || []).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Settled Amount</p>
            <p className="text-2xl font-bold text-green-600 font-mono">{formatBDT((settlements || []).reduce((s: number, x: any) => s + (x.total_paid_amount || 0), 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Shipments */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Shipments</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[200px]" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Courier</TableHead>
                  <TableHead>Consignment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">COD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(shipments || []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No shipments yet</TableCell></TableRow>
                ) : (
                  (shipments || []).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-sm">{s.courier_name || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{s.consignment_id || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{s.courier_status}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBDT(s.expected_charge || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{s.actual_charge != null ? formatBDT(s.actual_charge) : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{s.cod_expected_amount != null ? formatBDT(s.cod_expected_amount) : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* COD Settlements */}
      <Card>
        <CardHeader><CardTitle className="text-base">COD Settlements</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Matched</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(settlements || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No settlements imported yet</TableCell></TableRow>
              ) : (
                (settlements || []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{s.settlement_date}</TableCell>
                    <TableCell className="font-medium text-sm">{s.courier_name}</TableCell>
                    <TableCell className="text-sm font-mono">{s.settlement_ref || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-600">{formatBDT(s.total_paid_amount)}</TableCell>
                    <TableCell className="text-sm">{s.matched_count}/{s.total_orders}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{s.status}</Badge></TableCell>
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
