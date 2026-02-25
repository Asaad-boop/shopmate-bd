import { useState } from "react";
import { usePayrollList, useGeneratePayroll, useMarkPayrollPaid, useUpdatePayroll } from "@/hooks/use-payroll";
import { useEmployees } from "@/hooks/use-hrm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { KpiCard } from "@/components/ui/kpi-card";
import { DollarSign, Users, Clock, CheckCircle, Play, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function PayrollTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: payroll = [], isLoading } = usePayrollList(month, year);
  const generate = useGeneratePayroll();
  const markPaid = useMarkPayrollPaid();
  const updatePayroll = useUpdatePayroll();

  const totalNet = payroll.reduce((s, p) => s + (p.net_salary || 0), 0);
  const paidCount = payroll.filter((p) => p.payment_status === "paid").length;
  const pendingCount = payroll.filter((p) => p.payment_status === "pending").length;
  const totalOT = payroll.reduce((s, p) => s + (p.overtime_hours || 0), 0);

  const [editRow, setEditRow] = useState<any>(null);

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Payroll" value={`৳${totalNet.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} subtitle={`${MONTHS[month - 1]} ${year}`} />
        <KpiCard title="Employees" value={String(payroll.length)} icon={<Users className="w-5 h-5" />} subtitle="In payroll" />
        <KpiCard title="Paid" value={String(paidCount)} icon={<CheckCircle className="w-5 h-5" />} subtitle={`${pendingCount} pending`} />
        <KpiCard title="Total OT Hours" value={totalOT.toFixed(1)} icon={<Clock className="w-5 h-5" />} subtitle="This month" />
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Monthly Payroll</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => generate.mutate({ month, year })} disabled={generate.isPending}>
                <Play className="w-4 h-4 mr-1" /> Generate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">OT Hrs</TableHead>
                  <TableHead className="text-right">OT Amount</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : payroll.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No payroll generated yet. Click "Generate" to create.</TableCell></TableRow>
                ) : payroll.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <div>{p.employees?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{p.employees?.employee_id}</div>
                    </TableCell>
                    <TableCell>{p.employees?.departments?.name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">৳{(p.basic_salary || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{(p.overtime_hours || 0).toFixed(1)}</TableCell>
                    <TableCell className="text-right font-mono">৳{(p.overtime_amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">৳{(p.bonus || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">৳{(p.deductions || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">৳{(p.net_salary || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={p.payment_status === "paid" ? "default" : "secondary"} className={cn(p.payment_status === "paid" && "bg-emerald-500/10 text-emerald-600 border-emerald-200")}>
                        {p.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                         {p.payment_status === "pending" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditRow(p)}>Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => markPaid.mutate({ id: p.id, payment_method: "bank", post_to_gl: true })}>
                              <CreditCard className="w-3 h-3 mr-1" /> Pay & Post
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editRow && (
        <EditPayrollDialog
          row={editRow}
          onClose={() => setEditRow(null)}
          onSave={(vals) => {
            const net = (vals.basic_salary || 0) + (vals.overtime_amount || 0) + (vals.bonus || 0) - (vals.deductions || 0);
            updatePayroll.mutate({ id: editRow.id, ...vals, net_salary: net });
            setEditRow(null);
          }}
        />
      )}
    </div>
  );
}

function EditPayrollDialog({ row, onClose, onSave }: { row: any; onClose: () => void; onSave: (v: any) => void }) {
  const [bonus, setBonus] = useState(row.bonus || 0);
  const [deductions, setDeductions] = useState(row.deductions || 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Payroll — {row.employees?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Basic Salary</label>
            <Input value={row.basic_salary} disabled className="font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium">Bonus</label>
            <Input type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} className="font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium">Deductions</label>
            <Input type="number" value={deductions} onChange={(e) => setDeductions(Number(e.target.value))} className="font-mono" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave({ basic_salary: row.basic_salary, overtime_amount: row.overtime_amount, bonus, deductions })}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
