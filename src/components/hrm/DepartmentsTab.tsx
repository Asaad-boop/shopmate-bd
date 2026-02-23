import { useState } from "react";
import { useDepartments, useEmployees } from "@/hooks/use-hrm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Building2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export function DepartmentsTab() {
  const { data: departments, isLoading } = useDepartments();
  const { data: employees } = useEmployees();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const handleAdd = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("departments").insert({ name: name.trim(), description: desc.trim() || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Department created");
    qc.invalidateQueries({ queryKey: ["hrm-departments"] });
    setAddOpen(false);
    setName("");
    setDesc("");
  };

  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{departments?.length || 0} departments</p>
        <Button onClick={() => setAddOpen(true)} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> Add Department</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments?.map((dept: any) => {
          const count = employees?.filter((e: any) => e.department_id === dept.id).length || 0;
          return (
            <Card key={dept.id} className="rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{dept.name}</h3>
                    {dept.description && <p className="text-xs text-muted-foreground mt-0.5">{dept.description}</p>}
                    <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{count} employees</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" /></div>
            <div><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
