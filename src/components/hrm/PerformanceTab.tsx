import { useState } from "react";
import { usePerformanceReviews, useAddReview, useGoals, useAddGoal, useUpdateGoal } from "@/hooks/use-performance";
import { useEmployees } from "@/hooks/use-hrm";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/ui/kpi-card";
import { Star, Target, TrendingUp, Plus, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export function PerformanceTab() {
  return (
    <Tabs defaultValue="reviews">
      <TabsList className="bg-muted/50 p-1 rounded-xl">
        <TabsTrigger value="reviews" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
          <Star className="w-4 h-4" /> Reviews
        </TabsTrigger>
        <TabsTrigger value="goals" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
          <Target className="w-4 h-4" /> Goals & KPIs
        </TabsTrigger>
      </TabsList>
      <TabsContent value="reviews"><ReviewsSection /></TabsContent>
      <TabsContent value="goals"><GoalsSection /></TabsContent>
    </Tabs>
  );
}

// ── Reviews Section ──
function ReviewsSection() {
  const { data: reviews = [], isLoading } = usePerformanceReviews();
  const { data: employees = [] } = useEmployees();
  const addReview = useAddReview();
  const [showAdd, setShowAdd] = useState(false);

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : "—";
  const completedCount = reviews.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard title="Avg Rating" value={avgRating} icon={<Star className="w-5 h-5" />} subtitle="Out of 5" />
        <KpiCard title="Total Reviews" value={String(reviews.length)} icon={<Award className="w-5 h-5" />} />
        <KpiCard title="Completed" value={String(completedCount)} icon={<TrendingUp className="w-5 h-5" />} subtitle={`${reviews.length - completedCount} drafts`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Performance Reviews</CardTitle>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add Review</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : reviews.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No reviews yet</TableCell></TableRow>
                ) : reviews.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div>{r.employees?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.employees?.employee_id}</div>
                    </TableCell>
                    <TableCell className="capitalize">{r.review_period}</TableCell>
                    <TableCell>{r.review_date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={cn("w-4 h-4", s <= (r.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{r.reviewer_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "completed" ? "default" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showAdd && (
        <AddReviewDialog
          employees={employees}
          onClose={() => setShowAdd(false)}
          onSave={(v) => { addReview.mutate(v); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function AddReviewDialog({ employees, onClose, onSave }: { employees: any[]; onClose: () => void; onSave: (v: any) => void }) {
  const [empId, setEmpId] = useState("");
  const [rating, setRating] = useState(3);
  const [period, setPeriod] = useState("monthly");
  const [reviewer, setReviewer] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comment, setComment] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Performance Review</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Employee</label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Period</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Rating</label>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(s)} className="focus:outline-none">
                    <Star className={cn("w-6 h-6 cursor-pointer transition-colors", s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-300")} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Reviewer Name</label>
            <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Manager name" />
          </div>
          <div>
            <label className="text-sm font-medium">Strengths</label>
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">Areas for Improvement</label>
            <Textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">Overall Comment</label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!empId} onClick={() => onSave({
              employee_id: empId, rating, review_period: period, reviewer_name: reviewer,
              strengths, improvements, overall_comment: comment, status: "completed"
            })}>Save Review</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Goals Section ──
function GoalsSection() {
  const { data: goals = [], isLoading } = useGoals();
  const { data: employees = [] } = useEmployees();
  const addGoal = useAddGoal();
  const updateGoal = useUpdateGoal();
  const [showAdd, setShowAdd] = useState(false);

  const completedGoals = goals.filter((g) => g.status === "completed").length;
  const avgProgress = goals.length
    ? Math.round(goals.reduce((s, g) => s + ((g.current_value || 0) / (g.target_value || 1)) * 100, 0) / goals.length)
    : 0;

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard title="Total Goals" value={String(goals.length)} icon={<Target className="w-5 h-5" />} />
        <KpiCard title="Completed" value={String(completedGoals)} icon={<TrendingUp className="w-5 h-5" />} />
        <KpiCard title="Avg Progress" value={`${avgProgress}%`} icon={<Award className="w-5 h-5" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Employee Goals & KPIs</CardTitle>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add Goal</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : goals.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No goals set yet</TableCell></TableRow>
                ) : goals.map((g: any) => {
                  const pct = g.target_value ? Math.min(100, Math.round(((g.current_value || 0) / g.target_value) * 100)) : 0;
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        <div>{g.employees?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{g.employees?.employee_id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{g.title}</div>
                        {g.description && <div className="text-xs text-muted-foreground line-clamp-1">{g.description}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="w-32 space-y-1">
                          <Progress value={pct} className="h-2" />
                          <div className="text-xs text-muted-foreground">{g.current_value || 0}/{g.target_value}{g.unit}</div>
                        </div>
                      </TableCell>
                      <TableCell>{g.due_date || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={g.status === "completed" ? "default" : g.status === "in_progress" ? "secondary" : "outline"}>
                          {g.status?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {g.status !== "completed" && (
                          <Button size="sm" variant="ghost" onClick={() => updateGoal.mutate({ id: g.id, status: "completed", current_value: g.target_value })}>
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showAdd && (
        <AddGoalDialog
          employees={employees}
          onClose={() => setShowAdd(false)}
          onSave={(v) => { addGoal.mutate(v); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function AddGoalDialog({ employees, onClose, onSave }: { employees: any[]; onClose: () => void; onSave: (v: any) => void }) {
  const [empId, setEmpId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState(100);
  const [unit, setUnit] = useState("%");
  const [dueDate, setDueDate] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Goal / KPI</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Employee</label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Goal Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Achieve 95% attendance" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Target</label>
              <Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-sm font-medium">Unit</label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="%">%</SelectItem>
                  <SelectItem value="units">Units</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="tasks">Tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!empId || !title} onClick={() => onSave({
              employee_id: empId, title, description: desc, target_value: target, unit, due_date: dueDate || null,
            })}>Add Goal</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
