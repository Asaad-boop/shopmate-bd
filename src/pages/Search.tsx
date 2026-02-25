import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Global Search</h1>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search orders, products, customers, tracking IDs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-lg"
          autoFocus
        />
      </div>
      {!query && (
        <p className="text-muted-foreground text-sm">Type to search across orders, products, customers, and tracking IDs.</p>
      )}
    </div>
  );
}
