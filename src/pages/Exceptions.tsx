import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { ExceptionsQueueTab } from "@/components/exceptions/ExceptionsQueueTab";
import { RulesChecksTab } from "@/components/exceptions/RulesChecksTab";
import { ResolutionLogTab } from "@/components/exceptions/ResolutionLogTab";
import { HealthDashboardTab } from "@/components/exceptions/HealthDashboardTab";

const tabs = [
  { value: "queue", label: "Exceptions Queue" },
  { value: "rules", label: "Rules & Checks" },
  { value: "log", label: "Resolution Log" },
  { value: "health", label: "Health Dashboard" },
];

export default function ExceptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "queue";
  const setTab = (t: string) => setSearchParams({ tab: t });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Exceptions Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Unified control tower for operational & financial inconsistencies</p>
      </div>
      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="queue"><ExceptionsQueueTab /></TabsContent>
        <TabsContent value="rules"><RulesChecksTab /></TabsContent>
        <TabsContent value="log"><ResolutionLogTab /></TabsContent>
        <TabsContent value="health"><HealthDashboardTab /></TabsContent>
      </Tabs>
    </div>
  );
}
