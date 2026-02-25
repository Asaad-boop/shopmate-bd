import { Package } from "lucide-react";

export default function PreOrderList() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Package className="w-6 h-6" /> Pre-Order List
      </h1>
      <p className="text-muted-foreground">Manage pre-orders and backorders. Coming soon.</p>
      <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
        No pre-orders yet.
      </div>
    </div>
  );
}
