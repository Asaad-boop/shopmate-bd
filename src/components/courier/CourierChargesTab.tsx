import { useState } from "react";
import { useCouriers, useCourierShipments, useUpdateShipmentCosts } from "@/hooks/use-courier";
import { calculateNetPayable } from "@/lib/courier-calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBDT2 } from "@/lib/format";
import { Edit2, Save, AlertTriangle, Info } from "lucide-react";

function NetPayableCell({ shipment }: { shipment: any }) {
  const result = calculateNetPayable({
    collectable_amount: shipment.customer_total_amount,
    courier_delivery_fee: shipment.courier_delivery_fee,
    courier_cod_fee: shipment.courier_cod_fee,
    courier_discount: shipment.courier_discount,
    courier_promo_discount: shipment.courier_promo_discount,
    courier_additional_charge: shipment.courier_additional_charge,
    courier_compensation_cost: shipment.courier_compensation_cost,
    is_return: shipment.booking_status === "returned",
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs font-semibold text-primary cursor-help inline-flex items-center gap-1">
            {result.warning ? (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span className="text-amber-600">N/A</span>
              </>
            ) : (
              <>
                {formatBDT2(result.netPayable)}
                <Info className="w-3 h-3 text-muted-foreground" />
              </>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          {result.warning ? (
            <p className="text-xs text-amber-600">{result.warning}</p>
          ) : (
            <div className="text-xs space-y-0.5 font-mono">
              {result.breakdown.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CourierChargesTab() {
  const { data: couriers } = useCouriers();
  const [statusFilter, setStatusFilter] = useState("in_transit");
  const [courierFilter, setCourierFilter] = useState("all");
  const { data, isLoading } = useCourierShipments({ status: statusFilter, courierId: courierFilter, page: 0, pageSize: 100 });
  const updateCosts = useUpdateShipmentCosts();

  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    delivery_fee: 0, cod_fee: 0, discount: 0,
    promo_discount: 0, additional_charge: 0, compensation_cost: 0,
  });

  const openEdit = (shipment: any) => {
    setEditing(shipment);
    setForm({
      delivery_fee: shipment.courier_delivery_fee || 0,
      cod_fee: shipment.courier_cod_fee || 0,
      discount: shipment.courier_discount || 0,
      promo_discount: shipment.courier_promo_discount || 0,
      additional_charge: shipment.courier_additional_charge || 0,
      compensation_cost: shipment.courier_compensation_cost || 0,
    });
  };

  const handleSave = () => {
    if (!editing) return;
    updateCosts.mutate({
      id: editing.id,
      courier_delivery_fee: form.delivery_fee,
      courier_cod_fee: form.cod_fee,
      courier_discount: form.discount,
      courier_promo_discount: form.promo_discount,
      courier_additional_charge: form.additional_charge,
      courier_compensation_cost: form.compensation_cost,
      customer_total_amount: editing.customer_total_amount,
      is_return: editing.booking_status === "returned",
    });
    setEditing(null);
  };

  const editCalc = editing ? calculateNetPayable({
    collectable_amount: editing.customer_total_amount,
    courier_delivery_fee: form.delivery_fee,
    courier_cod_fee: form.cod_fee,
    courier_discount: form.discount,
    courier_promo_discount: form.promo_discount,
    courier_additional_charge: form.additional_charge,
    courier_compensation_cost: form.compensation_cost,
    is_return: editing.booking_status === "returned",
  }) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Courier Charges (In-Transit Costs)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={courierFilter} onValueChange={setCourierFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                {(couriers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="rounded-lg border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Order</TableHead>
                    <TableHead className="text-xs">Tracking</TableHead>
                    <TableHead className="text-xs">Courier</TableHead>
                    <TableHead className="text-xs">Customer Total</TableHead>
                    <TableHead className="text-xs">Del. Fee</TableHead>
                    <TableHead className="text-xs">COD Fee</TableHead>
                    <TableHead className="text-xs">Discount</TableHead>
                    <TableHead className="text-xs">Total Cost</TableHead>
                    <TableHead className="text-xs">Net Payable</TableHead>
                    <TableHead className="text-xs w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data || []).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs font-mono">{s.order_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs font-mono">{s.tracking_id || "-"}</TableCell>
                      <TableCell className="text-xs">{s.couriers?.name}</TableCell>
                      <TableCell className="text-xs">{formatBDT2(s.customer_total_amount)}</TableCell>
                      <TableCell className="text-xs">{formatBDT2(s.courier_delivery_fee)}</TableCell>
                      <TableCell className="text-xs">{formatBDT2(s.courier_cod_fee)}</TableCell>
                      <TableCell className="text-xs">{formatBDT2(s.courier_discount)}</TableCell>
                      <TableCell className="text-xs font-semibold">{formatBDT2(s.courier_total_cost)}</TableCell>
                      <TableCell><NetPayableCell shipment={s} /></TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.data || []).length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">No shipments found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Courier Charges</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Customer Total</span>
              <Badge variant="outline">{formatBDT2(editing?.customer_total_amount)}</Badge>
            </div>
            {editCalc?.warning && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-md p-2 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {editCalc.warning}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Delivery Fee</Label>
                <Input type="number" value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: +e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">COD Fee</Label>
                <Input type="number" value={form.cod_fee} onChange={(e) => setForm({ ...form, cod_fee: +e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Discount</Label>
                <Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Promo Discount</Label>
                <Input type="number" value={form.promo_discount} onChange={(e) => setForm({ ...form, promo_discount: +e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Additional Charge</Label>
                <Input type="number" value={form.additional_charge} onChange={(e) => setForm({ ...form, additional_charge: +e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Compensation</Label>
                <Input type="number" value={form.compensation_cost} onChange={(e) => setForm({ ...form, compensation_cost: +e.target.value })} />
              </div>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
               <span>Total Cost: <strong>{editCalc ? formatBDT2(editCalc.totalCost) : "—"}</strong></span>
               <span>Net Payable: <strong className="text-primary">{editCalc ? formatBDT2(editCalc.netPayable) : "—"}</strong></span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={updateCosts.isPending}>
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
