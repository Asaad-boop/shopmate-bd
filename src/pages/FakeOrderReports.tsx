import { ShieldAlert } from "lucide-react";

export default function FakeOrderReports() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldAlert className="w-6 h-6" /> Fake Order Block Reports
      </h1>
      <p className="text-muted-foreground">Track blocked/fraudulent orders and customer patterns. Coming soon.</p>
      <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
        No fake order reports yet.
      </div>
    </div>
  );
}
