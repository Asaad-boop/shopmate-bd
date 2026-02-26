import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

export function GlobalSearchTrigger() {
  const navigate = useNavigate();

  const openSearch = useCallback(() => {
    navigate("/search");
  }, [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openSearch]);

  return (
    <button
      onClick={openSearch}
      className="flex items-center gap-2 w-full h-10 px-3.5 rounded-[14px] bg-muted text-muted-foreground text-sm transition-all duration-200 hover:bg-accent border border-border focus:outline-none focus:ring-2 focus:ring-primary/35 cursor-pointer"
    >
      <Search className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-left truncate">Search orders, products…</span>
      <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
