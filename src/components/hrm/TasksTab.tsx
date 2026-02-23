import { useState, useMemo } from "react";
import { useTasks, useAddTask, useUpdateTask, useDeleteTask, useTaskComments, useAddTaskComment } from "@/hooks/use-tasks";
import { useEmployees, useDepartments } from "@/hooks/use-hrm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KpiCard } from "@/components/ui/kpi-card";
import { Plus, GripVertical, MessageSquare, Trash2, Calendar, User, ListTodo, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const COLUMNS = [
  { key: "todo", label: "To Do", icon: ListTodo, color: "text-muted-foreground" },
  { key: "in_progress", label: "In Progress", icon: Clock, color: "text-blue-500" },
  { key: "done", label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
] as const;

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-amber-400/40 bg-amber-400/5",
  low: "border-border",
};

const PRIORITY_BADGES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-300/30",
  low: "bg-muted text-muted-foreground",
};

export function TasksTab() {
  const [deptFilter, setDeptFilter] = useState("all");
  const { data: tasks = [], isLoading } = useTasks(deptFilter);
  const { data: departments = [] } = useDepartments();
  const { data: employees = [] } = useEmployees();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const addTask = useAddTask();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = { todo: [], in_progress: [], done: [] };
    tasks.forEach((t) => {
      const col = map[t.status] || map.todo;
      col.push(t);
    });
    return map;
  }, [tasks]);

  const totalTasks = tasks.length;
  const doneTasks = grouped.done.length;
  const highPriority = tasks.filter((t) => t.priority === "high" && t.status !== "done").length;

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTask.mutate({ id: taskId, status: newStatus });
  };

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Tasks" value={String(totalTasks)} icon={<ListTodo className="w-5 h-5" />} />
        <KpiCard title="In Progress" value={String(grouped.in_progress.length)} icon={<Clock className="w-5 h-5" />} />
        <KpiCard title="Completed" value={String(doneTasks)} icon={<CheckCircle2 className="w-5 h-5" />} subtitle={totalTasks ? `${Math.round((doneTasks / totalTasks) * 100)}% done` : undefined} />
        <KpiCard title="High Priority" value={String(highPriority)} icon={<AlertCircle className="w-5 h-5" />} subtitle="Pending" />
      </div>

      {/* Filter + Add */}
      <div className="flex items-center justify-between gap-3">
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d: any) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> New Task</Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <col.icon className={cn("w-4 h-4", col.color)} />
              <span className="font-semibold text-sm">{col.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">{grouped[col.key].length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px] rounded-xl border border-dashed border-border/60 bg-muted/20 p-2">
              {grouped[col.key].length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
              )}
              {grouped[col.key].map((task: any) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentStatus={col.key}
                  onStatusChange={handleStatusChange}
                  onSelect={() => setSelectedTask(task)}
                  onDelete={() => deleteTask.mutate(task.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Dialog */}
      {showAdd && (
        <AddTaskDialog
          employees={employees}
          departments={departments}
          onClose={() => setShowAdd(false)}
          onSave={(v) => { addTask.mutate(v); setShowAdd(false); }}
        />
      )}

      {/* Task Detail Dialog with Comments */}
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

// ── Task Card ──
function TaskCard({ task, currentStatus, onStatusChange, onSelect, onDelete }: {
  task: any; currentStatus: string; onStatusChange: (id: string, s: string) => void;
  onSelect: () => void; onDelete: () => void;
}) {
  const nextStatuses = COLUMNS.filter((c) => c.key !== currentStatus);

  return (
    <div className={cn("rounded-lg border p-3 bg-card cursor-pointer hover:shadow-sm transition-shadow", PRIORITY_STYLES[task.priority])}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0" onClick={onSelect}>
          <p className="font-medium text-sm leading-tight line-clamp-2">{task.title}</p>
          {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>}
        </div>
        <Badge variant="outline" className={cn("text-[10px] shrink-0", PRIORITY_BADGES[task.priority])}>
          {task.priority}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {task.employees && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3" /> {task.employees.full_name}
          </span>
        )}
        {task.due_date && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {task.due_date}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 mt-2">
        {nextStatuses.map((ns) => (
          <Button key={ns.key} size="sm" variant="ghost" className="h-6 text-[10px] px-2"
            onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, ns.key); }}>
            → {ns.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="h-6 px-1 ml-auto text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-1" onClick={onSelect}>
          <MessageSquare className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Add Task Dialog ──
function AddTaskDialog({ employees, departments, onClose, onSave }: {
  employees: any[]; departments: any[]; onClose: () => void; onSave: (v: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dept, setDept] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Assign To</label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Department</label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
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
            <Button disabled={!title} onClick={() => onSave({
              title, description: desc || null,
              assigned_to: assignee || null,
              department_id: dept || null,
              priority, due_date: dueDate || null,
            })}>Create Task</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Task Detail Dialog ──
function TaskDetailDialog({ task, onClose, onStatusChange }: {
  task: any; onClose: () => void; onStatusChange: (id: string, s: string) => void;
}) {
  const { data: comments = [], isLoading } = useTaskComments(task.id);
  const addComment = useAddTaskComment();
  const [newComment, setNewComment] = useState("");

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate({ task_id: task.id, author_name: "Admin", content: newComment.trim() });
    setNewComment("");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task.title}
            <Badge variant="outline" className={cn("text-xs", PRIORITY_BADGES[task.priority])}>{task.priority}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
          <div className="flex flex-wrap gap-3 text-sm">
            {task.employees && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {task.employees.full_name}</span>}
            {task.departments && <span className="flex items-center gap-1">📁 {task.departments.name}</span>}
            {task.due_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {task.due_date}</span>}
          </div>

          {/* Status change buttons */}
          <div className="flex gap-2">
            {COLUMNS.filter((c) => c.key !== task.status).map((c) => (
              <Button key={c.key} size="sm" variant="outline" onClick={() => { onStatusChange(task.id, c.key); onClose(); }}>
                Move to {c.label}
              </Button>
            ))}
          </div>

          {/* Comments */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><MessageSquare className="w-4 h-4" /> Comments</h4>
            <ScrollArea className="h-[200px] rounded-lg border p-3">
              {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No comments yet</p>}
              {comments.map((c: any) => (
                <div key={c.id} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{c.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm mt-0.5">{c.content}</p>
                </div>
              ))}
            </ScrollArea>
            <div className="flex gap-2 mt-2">
              <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..."
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()} />
              <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>Post</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
