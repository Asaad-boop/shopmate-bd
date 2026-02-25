import { FolderOpen } from "lucide-react";

export default function CategoryBrand() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FolderOpen className="w-6 h-6" /> Category & Brand
      </h1>
      <p className="text-muted-foreground">Manage product categories and brands. Coming soon.</p>
      <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
        No categories or brands configured yet.
      </div>
    </div>
  );
}
