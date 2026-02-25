import { ShieldCheck } from "lucide-react";

export default function WarrantyPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldCheck className="w-6 h-6" /> Warranty Management
      </h1>
      <p className="text-muted-foreground">Track product warranties and claims. Coming soon.</p>
      <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
        No warranty records yet.
      </div>
    </div>
  );
}
