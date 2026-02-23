import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useAttendanceByDate, useMonthlyAttendanceSummary, useCheckIn, useCheckOut, useMarkAttendance } from "@/hooks/use-attendance";
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
import { Calendar, Clock, LogIn, LogOut, AlertTriangle, Users, Timer, TrendingUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function AttendanceTab() {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentMonth = format(new Date(), "yyyy-MM");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [markOpen, setMarkOpen] = useState(false);
  const [markEmpId, setMarkEmpId] = useState("");
  const [markStatus, setMarkStatus] = useState("present");
  const [markCheckIn, setMarkCheckIn] = useState("09:00");
  const [markCheckOut, setMarkCheckOut] = useState("18:00");
  const [markNotes, setMarkNotes] = useState("");

  const { data: todayAttendance, isLoading: loadingToday } = useAttendanceByDate(selectedDate);
  const { data: monthlySummary, isLoading: loadingMonthly } = useMonthlyAttendanceSummary(selectedMonth);
  const { data: employees } = useEmployees();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const markAttendance = useMarkAttendance();

  // Employees who haven't checked in today
  const checkedInIds = new Set((todayAttendance || []).map((a: any) => a.employee_id));
  const activeEmployees = (employees || []).filter((e: any) => e.status === "active");
  const notCheckedIn = activeEmployees.filter((e: any) => !checkedInIds.has(e.id));

  // KPI stats for today
  const todayStats = useMemo(() => {
    const records = todayAttendance || [];
    return {
      present: records.filter((r: any) => r.status === "present" || r.status === "late").length,
      absent: activeEmployees.length - records.filter((r: any) => r.status === "present" || r.status === "late").length,
      late: records.filter((r: any) => r.is_late).length,
      avgHours: records.length > 0
        ? (records.reduce((s: number, r: any) => s + (r.working_hours || 0), 0) / records.length).toFixed(1)
        : "0",
    };
  }, [todayAttendance, activeEmployees]);

  const handleMarkAttendance = () => {
    if (!markEmpId) return;
    const dateStr = selectedDate;
    const checkInTime = markStatus !== "absent" ? `${dateStr}T${markCheckIn}:00+06:00` : undefined;
    const checkOutTime = markStatus !== "absent" && markCheckOut ? `${dateStr}T${markCheckOut}:00+06:00` : undefined;

    markAttendance.mutate({
      employee_id: markEmpId,
      date: dateStr,
      check_in: checkInTime,
      check_out: checkOutTime,
      status: markStatus,
      notes: markNotes || undefined,
    });
    setMarkOpen(false);
    setMarkEmpId("");
    setMarkNotes("");
  };

  const kpis = [
    { label: "Present Today", value: todayStats.present, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Absent", value: todayStats.absent, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Late Arrivals", value: todayStats.late, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Avg Hours", value: todayStats.avgHours, icon: Timer, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Cards */}
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

      {/* Sub-tabs */}
      <Tabs defaultValue="daily">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="daily" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Calendar className="w-4 h-4" /> Daily View
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <TrendingUp className="w-4 h-4" /> Monthly Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-48 rounded-xl" />
              <Button onClick={() => setMarkOpen(true)} className="gap-2 rounded-xl">
                <Clock className="w-4 h-4" /> Mark Attendance
              </Button>
            </div>

            {loadingToday ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : (
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Employee</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead className="hidden md:table-cell">Hours</TableHead>
                      <TableHead className="hidden md:table-cell">Overtime</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(todayAttendance || []).map((att: any) => (
                      <TableRow key={att.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                              {att.employees?.full_name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{att.employees?.full_name}</p>
                              <p className="text-xs text-muted-foreground">{att.employees?.employee_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-['DM_Mono'] text-sm">
                          {att.check_in ? format(parseISO(att.check_in), "hh:mm a") : "—"}
                        </TableCell>
                        <TableCell className="font-['DM_Mono'] text-sm">
                          {att.check_out ? format(parseISO(att.check_out), "hh:mm a") : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-['DM_Mono'] text-sm">
                          {att.working_hours ? `${att.working_hours}h` : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-['DM_Mono'] text-sm">
                          {att.overtime_hours > 0 ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{att.overtime_hours}h OT</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {att.is_late && (
                              <Badge className="bg-amber-100 text-amber-700 text-xs">Late</Badge>
                            )}
                            <Badge className={
                              att.status === "present" ? "bg-emerald-100 text-emerald-700" :
                              att.status === "absent" ? "bg-red-100 text-red-700" :
                              "bg-muted text-muted-foreground"
                            }>
                              {att.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {!att.check_out && att.check_in && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 rounded-lg text-xs"
                              onClick={() => checkOut.mutate({ employee_id: att.employee_id, date: selectedDate })}
                            >
                              <LogOut className="w-3 h-3" /> Check Out
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Not checked in employees */}
                    {notCheckedIn.map((emp: any) => (
                      <TableRow key={emp.id} className="opacity-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground font-semibold text-sm">
                              {emp.full_name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{emp.full_name}</p>
                              <p className="text-xs text-muted-foreground">{emp.employee_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">Not checked in</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="gap-1 rounded-lg text-xs"
                            onClick={() => checkIn.mutate({ employee_id: emp.id, date: selectedDate })}
                          >
                            <LogIn className="w-3 h-3" /> Check In
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="summary">
          <div className="space-y-4">
            <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-48 rounded-xl" />

            {loadingMonthly ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : (
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Warning</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(monthlySummary || []).map((emp: any) => (
                      <TableRow key={emp.employee_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{emp.full_name}</p>
                            <p className="text-xs text-muted-foreground">{emp.emp_code}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{emp.department || "—"}</TableCell>
                        <TableCell className="font-['DM_Mono'] text-sm text-emerald-600">{emp.present}</TableCell>
                        <TableCell className="font-['DM_Mono'] text-sm text-red-600">{emp.absent}</TableCell>
                        <TableCell className="font-['DM_Mono'] text-sm text-amber-600">{emp.late}</TableCell>
                        <TableCell className="font-['DM_Mono'] text-sm">{emp.totalHours.toFixed(1)}h</TableCell>
                        <TableCell className="font-['DM_Mono'] text-sm">{emp.overtimeHours.toFixed(1)}h</TableCell>
                        <TableCell>
                          {emp.late >= 3 && (
                            <Badge className="bg-red-100 text-red-700 text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" /> Late Warning
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!monthlySummary || monthlySummary.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No attendance records for this month
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Mark Attendance Dialog */}
      <Dialog open={markOpen} onOpenChange={setMarkOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Employee</label>
              <Select value={markEmpId} onValueChange={setMarkEmpId}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={markStatus} onValueChange={setMarkStatus}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {markStatus !== "absent" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Check In</label>
                  <Input type="time" value={markCheckIn} onChange={(e) => setMarkCheckIn(e.target.value)} className="rounded-xl mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Check Out</label>
                  <Input type="time" value={markCheckOut} onChange={(e) => setMarkCheckOut(e.target.value)} className="rounded-xl mt-1" />
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={markNotes} onChange={(e) => setMarkNotes(e.target.value)} placeholder="Optional notes..." className="rounded-xl mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleMarkAttendance} disabled={!markEmpId} className="rounded-xl">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
