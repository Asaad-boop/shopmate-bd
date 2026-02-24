import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useChartOfAccounts, useAddAccount, useToggleAccountActive } from "@/hooks/use-accounting";
import { Plus, ChevronRight } from "lucide-react";

const heading = { fontFamily: "'Playfair Display', serif" };
const mono = { fontFamily: "'DM Mono', monospace" };

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800",
  liability: "bg-amber-100 text-amber-800",
  income: "bg-emerald-100 text-emerald-800",
  expense: "bg-red-100 text-red-800",
  cogs: "bg-orange-100 text-orange-800",
  equity: "bg-purple-100 text-purple-800",
};

export function ChartOfAccountsTab() {
  const { data: accounts, isLoading } = useChartOfAccounts();
  const addAcct = useAddAccount();
  const toggleActive = useToggleAccountActive();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("asset");
  const [parentId, setParentId] = useState<string>("");
  const [normalBal, setNormalBal] = useState("debit");
  const [description, setDescription] = useState("");

  const parentAccounts = (accounts || []).filter((a) => !a.parent_id);

  const buildTree = () => {
    const roots = (accounts || []).filter((a) => !a.parent_id);
    return roots.map((root) => ({
      ...root,
      children: (accounts || []).filter((a) => a.parent_id === root.id),
    }));
  };

  const tree = buildTree();

  const handleSave = () => {
    if (!code || !name) return;
    addAcct.mutate(
      { code, name, account_type: type, parent_id: parentId || null, normal_balance: normalBal, description: description || undefined },
      { onSuccess: () => { setOpen(false); setCode(""); setName(""); setDescription(""); } }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={heading}>Chart of Accounts</h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Account
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-semibold">Code</th>
                <th className="text-left p-3 font-semibold">Account Name</th>
                <th className="text-left p-3 font-semibold">Type</th>
                <th className="text-left p-3 font-semibold">Normal</th>
                <th className="text-center p-3 font-semibold">Active</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((root) => (
                <>
                  <tr key={root.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 font-mono font-bold" style={mono}>{root.code}</td>
                    <td className="p-3 font-semibold">{root.name}</td>
                    <td className="p-3"><Badge variant="secondary" className={TYPE_COLORS[root.account_type] || ""}>{root.account_type}</Badge></td>
                    <td className="p-3 capitalize text-muted-foreground">{root.normal_balance}</td>
                    <td className="p-3 text-center">
                      <Switch checked={root.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: root.id, is_active: v })} disabled={root.is_system} />
                    </td>
                  </tr>
                  {root.children.map((child) => (
                    <tr key={child.id} className="border-b border-border hover:bg-muted/30 bg-muted/10">
                      <td className="p-3 pl-8 font-mono" style={mono}>{child.code}</td>
                      <td className="p-3 pl-8 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        {child.name}
                      </td>
                      <td className="p-3"><Badge variant="secondary" className={TYPE_COLORS[child.account_type] || ""}>{child.account_type}</Badge></td>
                      <td className="p-3 capitalize text-muted-foreground">{child.normal_balance}</td>
                      <td className="p-3 text-center">
                        <Switch checked={child.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: child.id, is_active: v })} disabled={child.is_system} />
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle style={heading}>Add Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 1500" style={mono} /></div>
              <div><Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["asset","liability","income","expense","cogs","equity"].map(t =>
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" /></div>
            <div><Label>Parent Account (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder="None (root account)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parentAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Normal Balance</Label>
              <Select value={normalBal} onValueChange={setNormalBal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSave} disabled={addAcct.isPending}>
              {addAcct.isPending ? "Saving..." : "Create Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
