import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAddTransaction, INCOME_CATEGORIES, EXPENSE_CATEGORIES, CATEGORY_LABELS } from "@/hooks/use-finance";
import { useAccounts } from "@/hooks/use-finance";
import { format } from "date-fns";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export function AddTransactionModal({ open, onOpenChange }: Props) {
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  const addTxn = useAddTransaction();
  const { data: accounts } = useAccounts();

  useEffect(() => { setCategory(""); }, [type]);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSave = () => {
    if (!amount || !category) return;
    addTxn.mutate({
      type,
      amount: Number(amount),
      transaction_date: date,
      category,
      payment_method: paymentMethod || undefined,
      description: description || undefined,
      reference_type: reference || undefined,
      source_module: "manual",
    }, { onSuccess: () => { onOpenChange(false); setAmount(""); setDescription(""); setReference(""); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>Add Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("income")}
              className={`py-3 rounded-lg text-sm font-semibold transition-all ${type === "income" ? "bg-emerald-500 text-white shadow-lg" : "bg-muted text-muted-foreground"}`}
            >📈 Income</button>
            <button
              onClick={() => setType("expense")}
              className={`py-3 rounded-lg text-sm font-semibold transition-all ${type === "expense" ? "bg-red-500 text-white shadow-lg" : "bg-muted text-muted-foreground"}`}
            >📉 Expense</button>
          </div>
          {/* Amount */}
          <div>
            <Label>Amount (৳)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0"
              className="text-2xl h-14" style={{ fontFamily: "'DM Mono', monospace" }} />
          </div>
          {/* Date */}
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {/* Category */}
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Payment Method */}
          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                {["bkash", "nagad", "bank", "cash", "card"].map((m) => (
                  <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
          </div>
          {/* Reference */}
          <div>
            <Label>Reference (Order/PO #)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </div>
          <Button onClick={handleSave} disabled={addTxn.isPending} className={`w-full ${type === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
            {addTxn.isPending ? "Saving..." : "Save Transaction"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
