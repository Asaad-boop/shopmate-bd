import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChartOfAccounts, useAccountMappings, useUpdateAccountMapping } from "@/hooks/use-accounting";
import { Save } from "lucide-react";

const heading = { fontFamily: "'Playfair Display', serif" };

const MAPPING_LABELS: Record<string, { label: string; description: string }> = {
  inventory: { label: "Inventory", description: "Default account for inventory asset" },
  cogs: { label: "COGS", description: "Cost of goods sold" },
  product_sales: { label: "Product Sales", description: "Revenue from product sales" },
  shipping_income: { label: "Shipping Income", description: "Revenue from shipping charges" },
  courier_receivable: { label: "Courier Receivable", description: "Amount receivable from courier" },
  cash: { label: "Cash", description: "Default cash account" },
  bank: { label: "Bank", description: "Default bank account" },
  supplier_payable: { label: "Supplier Payable", description: "Amounts owed to suppliers" },
};

export function AccountMappingsTab() {
  const { data: accounts } = useChartOfAccounts();
  const { data: mappings } = useAccountMappings();
  const updateMapping = useUpdateAccountMapping();
  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mappings) {
      const map: Record<string, string> = {};
      mappings.forEach((m: any) => {
        if (m.account_id) map[m.mapping_key] = m.account_id;
      });
      setLocalMappings(map);
    }
  }, [mappings]);

  const handleSave = (key: string) => {
    updateMapping.mutate({ mapping_key: key, account_id: localMappings[key] || null });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold" style={heading}>Account Mappings</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure default GL accounts used by auto-posting rules (order delivery, COD receipt, expenses, purchases).
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-semibold w-[200px]">Mapping</th>
                <th className="text-left p-3 font-semibold">Description</th>
                <th className="text-left p-3 font-semibold w-[300px]">Account</th>
                <th className="text-right p-3 font-semibold w-[80px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MAPPING_LABELS).map(([key, info]) => (
                <tr key={key} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 font-medium">{info.label}</td>
                  <td className="p-3 text-muted-foreground text-xs">{info.description}</td>
                  <td className="p-3">
                    <Select
                      value={localMappings[key] || ""}
                      onValueChange={(v) => setLocalMappings((prev) => ({ ...prev, [key]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {(accounts || []).filter((a) => a.is_active).map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSave(key)}
                      disabled={updateMapping.isPending}
                    >
                      <Save className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
