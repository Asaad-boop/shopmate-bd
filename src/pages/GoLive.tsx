import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Building2, Package, Boxes, Wallet, History, ClipboardCheck, Rocket,
  CheckCircle2, Circle, ArrowRight, Download, Upload, ExternalLink,
} from "lucide-react";

const STEPS = [
  { key: "company_setup", label: "Company Setup", icon: Building2, desc: "Business identity & branding" },
  { key: "product_setup", label: "Product Setup", icon: Package, desc: "Import or add products" },
  { key: "opening_stock", label: "Opening Stock", icon: Boxes, desc: "Initial inventory quantities" },
  { key: "opening_balances", label: "Opening Balances", icon: Wallet, desc: "Finance account balances" },
  { key: "historical_sales", label: "Historical Sales", icon: History, desc: "Import past orders" },
  { key: "go_live_checklist", label: "Go-Live Checklist", icon: ClipboardCheck, desc: "Final verification" },
  { key: "launch", label: "Launch! 🚀", icon: Rocket, desc: "You're ready!" },
];

const CHECKLIST = [
  "All products added",
  "Opening stock entered",
  "Finance accounts configured",
  "At least one courier set up",
  "Team members added (HRM)",
  "Test order created and completed",
  "Invoice template configured",
];

export default function GoLivePage() {
  usePageTitle("Go Live");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [salesMode, setSalesMode] = useState("reporting");
  const [checklistState, setChecklistState] = useState<boolean[]>(new Array(CHECKLIST.length).fill(false));

  const { data: progress, isLoading } = useQuery({
    queryKey: ["go-live-progress"],
    queryFn: async () => {
      const { data, error } = await supabase.from("go_live_progress").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: productCount } = useQuery({
    queryKey: ["product-count"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: accountCount } = useQuery({
    queryKey: ["account-count"],
    queryFn: async () => {
      const { count } = await supabase.from("accounts").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const markComplete = useMutation({
    mutationFn: async (stepName: string) => {
      const { data: existing } = await supabase.from("go_live_progress").select("id").eq("step_name", stepName).maybeSingle();
      if (existing) {
        await supabase.from("go_live_progress").update({ completed: true, completed_at: new Date().toISOString() }).eq("step_name", stepName);
      } else {
        await supabase.from("go_live_progress").insert({ step_name: stepName, completed: true, completed_at: new Date().toISOString() });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["go-live-progress"] });
      toast.success("Step marked complete!");
    },
  });

  const completedSteps = (progress || []).filter((p: any) => p.completed).map((p: any) => p.step_name);
  const completionPct = Math.round((completedSteps.length / STEPS.length) * 100);
  const step = STEPS[activeStep];

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Rocket className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Go Live Setup</h1>
          <p className="text-sm text-muted-foreground">Complete the setup wizard to launch your ERP</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Overall Progress</span>
          <span className="font-semibold text-primary">{completionPct}%</span>
        </div>
        <Progress value={completionPct} className="h-2" />
      </div>

      <div className="flex gap-6">
        {/* Left: Step list */}
        <nav className="w-64 shrink-0 space-y-1">
          {STEPS.map((s, i) => {
            const done = completedSteps.includes(s.key);
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setActiveStep(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all",
                  activeStep === i ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50",
                )}
              >
                <div className={cn("p-1.5 rounded-lg", done ? "bg-emerald-100 text-emerald-600" : activeStep === i ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", done && "text-emerald-700 dark:text-emerald-400")}>{s.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.desc}</p>
                </div>
                {done && <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200">✓</Badge>}
              </button>
            );
          })}
        </nav>

        {/* Right: Step content */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <step.icon className="w-5 h-5 text-primary" />
                {step.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {step.key === "company_setup" && (
                <>
                  <p className="text-sm text-muted-foreground">Configure your company name, logo, address, and contact details.</p>
                  <Button onClick={() => navigate("/settings")} className="gap-2">
                    <ExternalLink className="w-4 h-4" /> Open Settings
                  </Button>
                  <Button variant="outline" onClick={() => markComplete.mutate("company_setup")} disabled={completedSteps.includes("company_setup")}>
                    {completedSteps.includes("company_setup") ? "✓ Completed" : "Mark Complete"}
                  </Button>
                </>
              )}

              {step.key === "product_setup" && (
                <>
                  <p className="text-sm text-muted-foreground">Import products from Excel or add them manually.</p>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-sm px-3 py-1.5">📦 {productCount} products added</Badge>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate("/products/new")} className="gap-2"><Package className="w-4 h-4" /> Add Product</Button>
                    <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Download Template</Button>
                    <Button variant="outline" className="gap-2"><Upload className="w-4 h-4" /> Import Excel</Button>
                  </div>
                  <Button variant="outline" onClick={() => markComplete.mutate("product_setup")} disabled={completedSteps.includes("product_setup")}>
                    {completedSteps.includes("product_setup") ? "✓ Completed" : "Mark Complete"}
                  </Button>
                </>
              )}

              {step.key === "opening_stock" && (
                <>
                  <p className="text-sm text-muted-foreground">Enter opening stock quantities and costs for each product.</p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate("/inventory")} className="gap-2"><Boxes className="w-4 h-4" /> Open Inventory</Button>
                    <Button variant="outline" className="gap-2"><Upload className="w-4 h-4" /> Bulk Import</Button>
                  </div>
                  <Button variant="outline" onClick={() => markComplete.mutate("opening_stock")} disabled={completedSteps.includes("opening_stock")}>
                    {completedSteps.includes("opening_stock") ? "✓ Completed" : "Mark Complete"}
                  </Button>
                </>
              )}

              {step.key === "opening_balances" && (
                <>
                  <p className="text-sm text-muted-foreground">Set opening balances for Cash, Bank, bKash, Nagad accounts.</p>
                  <Badge variant="outline" className="text-sm px-3 py-1.5">💰 {accountCount} accounts configured</Badge>
                  <Button variant="outline" onClick={() => navigate("/finance/accounts")} className="gap-2"><Wallet className="w-4 h-4" /> Open Accounts</Button>
                  <Button variant="outline" onClick={() => markComplete.mutate("opening_balances")} disabled={completedSteps.includes("opening_balances")}>
                    {completedSteps.includes("opening_balances") ? "✓ Completed" : "Mark Complete"}
                  </Button>
                </>
              )}

              {step.key === "historical_sales" && (
                <>
                  <p className="text-sm text-muted-foreground mb-4">Choose how to import historical sales data:</p>
                  <RadioGroup value={salesMode} onValueChange={setSalesMode} className="space-y-3">
                    <div className={cn("flex items-start gap-3 p-3 rounded-lg border", salesMode === "reporting" && "border-primary bg-primary/5")}>
                      <RadioGroupItem value="reporting" id="reporting" className="mt-0.5" />
                      <div>
                        <Label htmlFor="reporting" className="font-semibold text-sm cursor-pointer">Reporting Only</Label>
                        <p className="text-xs text-muted-foreground mt-1">Import sales history for reports only. No stock or accounting impact.</p>
                      </div>
                    </div>
                    <div className={cn("flex items-start gap-3 p-3 rounded-lg border", salesMode === "financial" && "border-primary bg-primary/5")}>
                      <RadioGroupItem value="financial" id="financial" className="mt-0.5" />
                      <div>
                        <Label htmlFor="financial" className="font-semibold text-sm cursor-pointer">Financial Only</Label>
                        <p className="text-xs text-muted-foreground mt-1">Import for financial records. Updates accounts but not inventory.</p>
                      </div>
                    </div>
                    <div className={cn("flex items-start gap-3 p-3 rounded-lg border", salesMode === "full" && "border-destructive bg-destructive/5")}>
                      <RadioGroupItem value="full" id="full" className="mt-0.5" />
                      <div>
                        <Label htmlFor="full" className="font-semibold text-sm cursor-pointer">Full Import</Label>
                        <p className="text-xs text-muted-foreground mt-1">⚠️ Complete import. Updates inventory, accounting, and all reports. Cannot undo.</p>
                      </div>
                    </div>
                  </RadioGroup>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="gap-2"><Upload className="w-4 h-4" /> Import Sales File</Button>
                    <Button variant="outline" onClick={() => markComplete.mutate("historical_sales")} disabled={completedSteps.includes("historical_sales")}>
                      {completedSteps.includes("historical_sales") ? "✓ Completed" : "Mark Complete"}
                    </Button>
                  </div>
                </>
              )}

              {step.key === "go_live_checklist" && (
                <>
                  <p className="text-sm text-muted-foreground mb-4">Verify all setup items are complete:</p>
                  <div className="space-y-3">
                    {CHECKLIST.map((item, i) => (
                      <label key={i} className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={checklistState[i]}
                          onCheckedChange={(checked) => {
                            const newState = [...checklistState];
                            newState[i] = !!checked;
                            setChecklistState(newState);
                          }}
                        />
                        <span className={cn("text-sm", checklistState[i] && "line-through text-muted-foreground")}>{item}</span>
                      </label>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => markComplete.mutate("go_live_checklist")}
                    disabled={completedSteps.includes("go_live_checklist") || !checklistState.every(Boolean)}
                  >
                    {completedSteps.includes("go_live_checklist") ? "✓ Completed" : "Mark Complete (all items required)"}
                  </Button>
                </>
              )}

              {step.key === "launch" && (
                <div className="text-center py-8 space-y-4">
                  {completionPct >= 100 ? (
                    <>
                      <div className="text-6xl mb-4">🚀</div>
                      <h2 className="text-2xl font-bold text-primary">System is Ready!</h2>
                      <p className="text-muted-foreground">Congratulations! Your ERP is fully configured and ready to use.</p>
                      <div className="flex justify-center gap-3 pt-4">
                        <Button onClick={() => navigate("/")} className="gap-2"><ArrowRight className="w-4 h-4" /> Go to Dashboard</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-6xl mb-4">⏳</div>
                      <h2 className="text-xl font-bold">Almost There!</h2>
                      <p className="text-muted-foreground">Complete all previous steps to launch. ({completionPct}% done)</p>
                      <Button variant="outline" onClick={() => setActiveStep(0)}>Go Back to Step 1</Button>
                    </>
                  )}
                </div>
              )}

              {/* Next button */}
              {activeStep < STEPS.length - 1 && step.key !== "launch" && (
                <div className="pt-4 border-t">
                  <Button onClick={() => setActiveStep(activeStep + 1)} variant="outline" className="gap-2">
                    Next Step <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
