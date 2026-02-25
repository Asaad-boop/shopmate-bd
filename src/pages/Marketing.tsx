import { Megaphone } from "lucide-react";

export default function MarketingPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Megaphone className="w-6 h-6" /> Marketing
      </h1>
      <p className="text-muted-foreground">Campaign management, promotions, and marketing analytics. Coming soon.</p>
      <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
        No marketing campaigns yet.
      </div>
    </div>
  );
}
