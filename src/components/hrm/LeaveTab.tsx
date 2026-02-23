import { useState, useMemo } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { useLeaveRequests, useLeaveBalances, useApplyLeave, useApproveLeave } from "@/hooks/use-leave";
import { useEmployees } from "@/hooks/use-hrm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Plus, CheckCircle2, XCircle, Clock, TreePalm, Stethoscope, Briefcase } from "lucide-react";

const leaveTypeColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  sick: "bg-red-100 text-red-700",
  casual: "bg-blue-100 text-blue-700",
  unpaid: "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export function LeaveTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [applyOpen, setApplyOpen] = useState(false);
  const [formEmpId, setFormEmpId] = useState("");
  const [formType, setFormType] = useState("casual");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formReason, setFormReason] = useState("");

  const { data: requests, isLoading } = useLeaveRequests(statusFilter);
  const { data: balances } = useLeaveBalances();
  const { data: employees } = useEmployees();
  const applyLeave = useApplyLeave();
  const approveLeave = useApproveLeave();

  const activeEmployees = (employees || []).filter((e: any) => e.status === "active");

  // Aggregate balances for KPI
  const balanceStats = useMemo(() => {
    const pending = (requests || []).filter((r: any) => r.status === "pending").length;
    const approved = (requests || []).filter((r: any) => r.status === "approved").length;
    const totalDays = (requests || []).filter((r: any) => r.status === "approved").reduce((s: number, r: any) => s + (r.days || 0), 0);
    return { pending, approved, totalDays };
  }, [requests]);

  const handleApply = () => {
    if (!formEmpId || !formStart || !formEnd) return;
    const days = differenceInDays(new Date(formEnd), new Date(formStart)) + 1;
    applyLeave.mutate({
      employee_id: formEmpId,
      leave_type: formType,
      start_date: formStart,
      end_date: formEnd,
      days: Math.max(days, 1),
      reason: formReason || undefined,
    });
    setApplyOpen(false);
    setFormEmpId("");
    setFormReason("");
    setFormStart("");
    setFormEnd("");
  };

  const kpis = [
    { label: "Pending Requests", value: balanceStats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Approved", value: balanceStats.approved, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Leave Days", value: balanceStats.totalDays, icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Employees", value: activeEmployees.length, icon: Briefcase, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-6 mt-4">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1 font-['DM_Mono']">{kpi.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="requests" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Leave Requests
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Leave Balances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setApplyOpen(true)} className="gap-2 rounded-xl">
                <Plus className="w-4 h-4" /> Apply Leave
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : (
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="hidden md:table-cell">Days</TableHead>
                      <TableHead className="hidden md:table-cell">Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(requests || []).map((req: any) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                              {req.employees?.full_name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{req.employees?.full_name}</p>
                              <p className="text-xs text-muted-foreground">{req.employees?.employee_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`capitalize text-xs ${leaveTypeColors[req.leave_type] || ""}`}>
                            {req.leave_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(parseISO(req.start_date), "dd MMM")} — {format(parseISO(req.end_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-['DM_Mono'] text-sm">{req.days}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{req.reason || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColors[req.status] || ""}`}>{req.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {req.status === "pending" && (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => approveLeave.mutate({ id: req.id, status: "approved" })}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => approveLeave.mutate({ id: req.id, status: "rejected" })}
                              >
                                <XCircle className="w-3 h-3" /> Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!requests || requests.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="balances">
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Employee</TableHead>
                  <TableHead>Paid Leave</TableHead>
                  <TableHead>Sick Leave</TableHead>
                  <TableHead>Casual Leave</TableHead>
                  <TableHead>Unpaid Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(balances || []).map((bal: any) => (
                  <TableRow key={bal.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{bal.employees?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{bal.employees?.employee_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-['DM_Mono'] text-sm">{bal.paid_leave_used}/{bal.paid_leave_total}</span>
                      <div className="w-20 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(bal.paid_leave_used / bal.paid_leave_total) * 100}%` }} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-['DM_Mono'] text-sm">{bal.sick_leave_used}/{bal.sick_leave_total}</span>
                      <div className="w-20 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${(bal.sick_leave_used / bal.sick_leave_total) * 100}%` }} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-['DM_Mono'] text-sm">{bal.casual_leave_used}/{bal.casual_leave_total}</span>
                      <div className="w-20 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(bal.casual_leave_used / bal.casual_leave_total) * 100}%` }} />
                      </div>
                    </TableCell>
                    <TableCell className="font-['DM_Mono'] text-sm">{bal.unpaid_leave_used}</TableCell>
                  </TableRow>
                ))}
                {(!balances || balances.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No leave balance records. Balances are created when leave is approved.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Apply Leave Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Employee</label>
              <Select value={formEmpId} onValueChange={setFormEmpId}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Leave Type</label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="paid">Paid Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="rounded-xl mt-1" />
              </div>
            </div>
            {formStart && formEnd && (
              <p className="text-sm text-muted-foreground">
                Duration: <span className="font-semibold text-foreground">{Math.max(differenceInDays(new Date(formEnd), new Date(formStart)) + 1, 1)} days</span>
              </p>
            )}
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder="Reason for leave..." className="rounded-xl mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleApply} disabled={!formEmpId || !formStart || !formEnd} className="rounded-xl">Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
