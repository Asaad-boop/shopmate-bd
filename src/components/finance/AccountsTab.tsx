import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAccounts, useAddTransaction } from "@/hooks/use-finance";
import { formatBDT } from "@/lib/format";
import { Plus, ArrowRightLeft, Wallet, Smartphone, Building2, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const mono = { fontFamily: "'DM Mono', monospace" };
const heading = { fontFamily: "'Playfair Display', serif" };

const ACCOUNT_ICONS: Record<string, React.ElementType> = {
  bkash: Smartphone, nagad: Smartphone, bank: Building2, cash: Banknote,
};

export function AccountsTab() {
  const { data: accounts, isLoading } = useAccounts();
  const [transferOpen, setTransferOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const addTxn = useAddTransaction();
  const qc = useQueryClient();

  const totalBalance = (accounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);

  const handleTransfer = async () => {
    if (!fromAccount || !toAccount || !transferAmount || fromAccount === toAccount) return;
    const amt = Number(transferAmount);
    // Create 2 transactions
    await supabase.from("transactions").insert([
      { type: "expense", amount: amt, transaction_date: format(new Date(), "yyyy-MM-dd"), category: "transfer_out", payment_method: fromAccount, description: `Transfer to ${toAccount}: ${transferNote}`, source_module: "transfer" },
      { type: "income", amount: amt, transaction_date: format(new Date(), "yyyy-MM-dd"), category: "transfer_in", payment_method: toAccount, description: `Transfer from ${fromAccount}: ${transferNote}`, source_module: "transfer" },
    ]);
    qc.invalidateQueries({ queryKey: ["finance"] });
    toast({ title: "Transfer completed" });
    setTransferOpen(false);
    setTransferAmount(""); setTransferNote("");
  };

  const handleAddAccount = async () => {
    if (!newName || !newType) return;
    await supabase.from("accounts").insert({ name: newName, type: newType, account_number: newNumber || null, balance: 0 });
    qc.invalidateQueries({ queryKey: ["finance-accounts"] });
    toast({ title: "Account added" });
    setAddOpen(false); setNewName(""); setNewType(""); setNewNumber("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={heading}>Cash Accounts</h3>
          <p className="text-sm text-muted-foreground">Total Balance: <span className="font-bold text-foreground" style={mono}>{formatBDT(totalBalance)}</span></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="w-4 h-4 mr-1" /> Transfer
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Account
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(accounts || []).map((a) => {
          const Icon = ACCOUNT_ICONS[a.type || ""] || Wallet;
          return (
            <Card key={a.id} className="border-[#e4e6ef]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#f4f5f9] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#0f172a]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{a.type} {a.account_number ? `• ${a.account_number}` : ""}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold" style={mono}>{formatBDT(Number(a.balance || 0))}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className={`w-2 h-2 rounded-full ${a.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
                  <span className="text-xs text-muted-foreground">{a.is_active ? "Active" : "Inactive"}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transfer Modal */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle style={heading}>Transfer Between Accounts</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>From</Label>
              <Select value={fromAccount} onValueChange={setFromAccount}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{(accounts || []).map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>To</Label>
              <Select value={toAccount} onValueChange={setToAccount}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{(accounts || []).map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (৳)</Label><Input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} style={mono} /></div>
            <div><Label>Note</Label><Textarea value={transferNote} onChange={(e) => setTransferNote(e.target.value)} rows={2} /></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleTransfer}>Transfer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Account Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle style={heading}>Add Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. bKash Personal" /></div>
            <div><Label>Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {["bkash", "nagad", "bank", "cash"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Account Number (optional)</Label><Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} /></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddAccount}>Add Account</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
