import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDepartments, useHrmRoles, useAddEmployee, useUpdateEmployee } from "@/hooks/use-hrm";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEmployee?: any;
}

export function AddEmployeeDrawer({ open, onOpenChange, editEmployee }: Props) {
  const { data: departments } = useDepartments();
  const { data: roles } = useHrmRoles();
  const addMut = useAddEmployee();
  const updateMut = useUpdateEmployee();
  const isEdit = !!editEmployee;

  const [form, setForm] = useState<any>(
    editEmployee || {
      full_name: "",
      email: "",
      phone: "",
      department_id: "",
      designation: "",
      hrm_role_id: "",
      basic_salary: 0,
      employment_type: "full_time",
      join_date: new Date().toISOString().slice(0, 10),
      gender: "",
      blood_group: "",
      nid_number: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      address: "",
      bank_name: "",
      bank_account_number: "",
      bkash_number: "",
      nagad_number: "",
      notes: "",
    }
  );

  const set = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  const handleSave = () => {
    if (!form.full_name) return;
    const payload = { ...form };
    if (!payload.department_id) delete payload.department_id;
    if (!payload.hrm_role_id) delete payload.hrm_role_id;

    if (isEdit) {
      updateMut.mutate({ id: editEmployee.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      addMut.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{isEdit ? "Edit Employee" : "Add New Employee"}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-6 py-4 space-y-5">
            {/* Personal Info */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personal Information</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="col-span-2">
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Enter full name" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Blood Group</Label>
                  <Select value={form.blood_group} onValueChange={(v) => set("blood_group", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>NID Number</Label>
                  <Input value={form.nid_number} onChange={(e) => set("nid_number", e.target.value)} />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth || ""} onChange={(e) => set("date_of_birth", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Work Info */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Work Information</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label>Department</Label>
                  <Select value={form.department_id} onValueChange={(v) => set("department_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
                    <SelectContent>
                      {departments?.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Senior Executive" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={form.hrm_role_id} onValueChange={(v) => set("hrm_role_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {roles?.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name} ({r.level})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Join Date</Label>
                  <Input type="date" value={form.join_date} onChange={(e) => set("join_date", e.target.value)} />
                </div>
                <div>
                  <Label>Basic Salary (৳)</Label>
                  <Input type="number" value={form.basic_salary} onChange={(e) => set("basic_salary", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Information</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label>Bank Name</Label>
                  <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input value={form.bank_account_number} onChange={(e) => set("bank_account_number", e.target.value)} />
                </div>
                <div>
                  <Label>bKash</Label>
                  <Input value={form.bkash_number} onChange={(e) => set("bkash_number", e.target.value)} />
                </div>
                <div>
                  <Label>Nagad</Label>
                  <Input value={form.nagad_number} onChange={(e) => set("nagad_number", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Emergency */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label>Contact Name</Label>
                  <Input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>
          </div>
        </ScrollArea>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={addMut.isPending || updateMut.isPending}>
            {isEdit ? "Update" : "Add Employee"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
