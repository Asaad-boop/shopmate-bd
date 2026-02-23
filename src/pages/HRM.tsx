import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Building2, BarChart3, Shield } from "lucide-react";
import { EmployeesTab } from "@/components/hrm/EmployeesTab";
import { DepartmentsTab } from "@/components/hrm/DepartmentsTab";
import { HrDashboardTab } from "@/components/hrm/HrDashboardTab";
import { RolesTab } from "@/components/hrm/RolesTab";

export default function HRMPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Human Resource Management</h1>
          <p className="text-sm text-muted-foreground">Manage employees, departments, roles & analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="dashboard" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="w-4 h-4" /> Employees
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="w-4 h-4" /> Departments
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Shield className="w-4 h-4" /> Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><HrDashboardTab /></TabsContent>
        <TabsContent value="employees"><EmployeesTab /></TabsContent>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
