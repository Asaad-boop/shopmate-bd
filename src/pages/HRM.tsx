import { useLocation } from "react-router-dom";
import { EmployeesTab } from "@/components/hrm/EmployeesTab";
import { DepartmentsTab } from "@/components/hrm/DepartmentsTab";
import { HrDashboardTab } from "@/components/hrm/HrDashboardTab";
import { RolesTab } from "@/components/hrm/RolesTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Shield } from "lucide-react";

const routeToTab: Record<string, string> = {
  "/hrm": "dashboard",
  "/hrm/employees": "employees",
  "/hrm/attendance": "attendance",
  "/hrm/payroll": "payroll",
  "/hrm/performance": "performance",
  "/hrm/leave": "leave",
  "/hrm/tasks": "tasks",
};

export default function HRMPage() {
  const location = useLocation();
  const activeTab = routeToTab[location.pathname] || "dashboard";

  // Sub-tabs for settings-like pages (departments, roles) are shown inside dashboard
  const showSubTabs = activeTab === "dashboard";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Human Resource Management</h1>
          <p className="text-sm text-muted-foreground">Manage employees, departments, roles & analytics</p>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <Tabs defaultValue="overview">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="overview" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="departments" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Building2 className="w-4 h-4" /> Departments
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Shield className="w-4 h-4" /> Roles
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><HrDashboardTab /></TabsContent>
          <TabsContent value="departments"><DepartmentsTab /></TabsContent>
          <TabsContent value="roles"><RolesTab /></TabsContent>
        </Tabs>
      )}

      {activeTab === "employees" && <EmployeesTab />}

      {activeTab === "attendance" && (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">Attendance Module</p>
          <p className="text-sm mt-1">Coming soon — Phase 2</p>
        </div>
      )}
      {activeTab === "payroll" && (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">Payroll Module</p>
          <p className="text-sm mt-1">Coming soon — Phase 3</p>
        </div>
      )}
      {activeTab === "performance" && (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">Performance Tracking</p>
          <p className="text-sm mt-1">Coming soon — Phase 3</p>
        </div>
      )}
      {activeTab === "leave" && (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">Leave Management</p>
          <p className="text-sm mt-1">Coming soon — Phase 2</p>
        </div>
      )}
      {activeTab === "tasks" && (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">Task Management</p>
          <p className="text-sm mt-1">Coming soon — Phase 4</p>
        </div>
      )}
    </div>
  );
}
