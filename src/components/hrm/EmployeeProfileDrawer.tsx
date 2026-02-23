import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Building2, Calendar, Banknote, Heart, Shield } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
}

export function EmployeeProfileDrawer({ open, onOpenChange, employee }: Props) {
  if (!employee) return null;
  const dept = employee.departments?.name || "—";
  const role = employee.hrm_roles?.name || "—";
  const level = employee.hrm_roles?.level || "staff";

  const statusColor = employee.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Employee Profile</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="px-6 py-5 space-y-5">
            {/* Header Card */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                {employee.full_name?.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{employee.full_name}</h3>
                <p className="text-sm text-muted-foreground">{employee.employee_id} • {employee.designation || "No designation"}</p>
                <div className="flex gap-2 mt-1">
                  <Badge className={statusColor}>{employee.status}</Badge>
                  <Badge variant="outline">{employee.employment_type?.replace("_", " ")}</Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact</p>
              <InfoRow icon={Mail} label="Email" value={employee.email} />
              <InfoRow icon={Phone} label="Phone" value={employee.phone} />
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Work</p>
              <InfoRow icon={Building2} label="Department" value={dept} />
              <InfoRow icon={Shield} label="Role" value={`${role} (${level})`} />
              <InfoRow icon={Calendar} label="Join Date" value={employee.join_date ? format(new Date(employee.join_date), "dd MMM yyyy") : "—"} />
              <InfoRow icon={Banknote} label="Basic Salary" value={`৳${(employee.basic_salary || 0).toLocaleString()}`} />
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Personal</p>
              <InfoRow icon={User} label="Gender" value={employee.gender} />
              <InfoRow icon={Heart} label="Blood Group" value={employee.blood_group} />
              <InfoRow icon={User} label="NID" value={employee.nid_number} />
              <InfoRow icon={Calendar} label="Date of Birth" value={employee.date_of_birth ? format(new Date(employee.date_of_birth), "dd MMM yyyy") : "—"} />
            </div>

            {(employee.bank_name || employee.bkash_number) && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment</p>
                  <InfoRow icon={Banknote} label="Bank" value={`${employee.bank_name || "—"} — ${employee.bank_account_number || "—"}`} />
                  <InfoRow icon={Phone} label="bKash" value={employee.bkash_number} />
                  <InfoRow icon={Phone} label="Nagad" value={employee.nagad_number} />
                </div>
              </>
            )}

            {employee.emergency_contact_name && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Emergency</p>
                  <InfoRow icon={User} label="Contact" value={employee.emergency_contact_name} />
                  <InfoRow icon={Phone} label="Phone" value={employee.emergency_contact_phone} />
                </div>
              </>
            )}

            {employee.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                  <p className="text-sm">{employee.notes}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
