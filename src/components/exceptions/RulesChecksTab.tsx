import { useExceptionRules, useToggleRule, useRunChecks } from "@/hooks/use-exceptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2 } from "lucide-react";
import { format } from "date-fns";

const MODULE_LABELS: Record<string, string> = {
  orders: "Orders", inventory: "Inventory", courier: "Courier", accounting: "Accounting",
  expenses: "Expenses", purchasing: "Purchasing", import: "Import", hrm: "HRM",
};

export function RulesChecksTab() {
  const { data: rules, isLoading } = useExceptionRules();
  const toggleMut = useToggleRule();
  const runChecks = useRunChecks();

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{rules?.length || 0} rules configured</p>
        <Button onClick={() => runChecks.mutate()} disabled={runChecks.isPending}>
          {runChecks.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
          Run All Checks Now
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Active</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rules?.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <Switch checked={rule.is_active} onCheckedChange={(v) => toggleMut.mutate({ id: rule.id, is_active: v })} />
                </TableCell>
                <TableCell className="font-mono text-xs">{rule.code}</TableCell>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{MODULE_LABELS[rule.module] || rule.module}</Badge></TableCell>
                <TableCell className="text-xs">{rule.schedule}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{rule.last_run_at ? format(new Date(rule.last_run_at), "dd MMM yy HH:mm") : "Never"}</TableCell>
                <TableCell className="text-xs">{rule.last_run_result || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
