import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZES = [25, 50, 100];

interface Props {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function InventoryPagination({ currentPage, totalPages, pageSize, totalItems, onPageChange, onPageSizeChange }: Props) {
  const start = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border/50">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {totalItems > 0 ? `${start}–${end} of ${totalItems}` : "0 results"}
        </p>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-[80px] h-8 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>{s}/page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} className="h-8 w-8 p-0 rounded-lg">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let page: number;
          if (totalPages <= 7) page = i + 1;
          else if (currentPage <= 4) page = i + 1;
          else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
          else page = currentPage - 3 + i;
          return (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              className="w-8 h-8 p-0 rounded-lg text-xs"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          );
        })}
        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} className="h-8 w-8 p-0 rounded-lg">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
