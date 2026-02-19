import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePathaoTrack } from "@/hooks/use-pathao";
import { cn } from "@/lib/utils";
import { Copy, ExternalLink, RefreshCw, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TRACKING_STEPS = [
  { key: "Pending", label: "Pending" },
  { key: "Pickup Requested", label: "Pickup Requested" },
  { key: "Picked Up", label: "Picked Up" },
  { key: "In Transit", label: "In Transit" },
  { key: "Delivered", label: "Delivered" },
];

const statusIndex = (status: string) => {
  const s = status?.toLowerCase() || "";
  if (s.includes("deliver")) return 4;
  if (s.includes("transit") || s.includes("hub")) return 3;
  if (s.includes("picked") || s.includes("pickup_done")) return 2;
  if (s.includes("pickup") || s.includes("assigned")) return 1;
  return 0;
};

export function PathaoTrackingCard({ consignmentId, trackingCode }: { consignmentId: string; trackingCode?: string }) {
  const { toast } = useToast();
  const { data, isLoading, refetch, isFetching } = usePathaoTrack(consignmentId);
  const orderStatus = data?.data?.order_status || data?.order_status || "Pending";
  const currentStep = statusIndex(orderStatus);
  const isReturned = orderStatus?.toLowerCase().includes("return");

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-green-600" />
          <CardTitle className="text-xs font-semibold">Pathao Tracking</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="rounded-md w-7 h-7" onClick={() => refetch()}>
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Consignment & Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{consignmentId}</code>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 rounded"
              onClick={() => {
                navigator.clipboard.writeText(consignmentId);
                toast({ title: "Copied!" });
              }}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Badge className={cn("text-[10px] rounded-md font-semibold",
            isReturned ? "bg-red-100 text-red-700" :
            currentStep >= 4 ? "bg-green-100 text-green-700" :
            "bg-blue-100 text-blue-700"
          )}>
            {orderStatus}
          </Badge>
        </div>

        {/* Tracking Timeline */}
        {isLoading ? (
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : (
          <div className="flex items-center gap-1">
            {TRACKING_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors",
                    i <= currentStep && !isReturned ? "bg-green-500 text-white" :
                    isReturned ? "bg-red-200 text-red-600" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {i <= currentStep && !isReturned ? "✓" : i + 1}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1 text-center leading-tight">{step.label}</span>
                </div>
                {i < TRACKING_STEPS.length - 1 && (
                  <div className={cn("h-0.5 w-full", i < currentStep && !isReturned ? "bg-green-500" : "bg-muted")} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Track link */}
        {trackingCode && (
          <a
            href={`https://pathao.com/parcel-tracking/?consignment_id=${trackingCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Track on Pathao
          </a>
        )}
      </CardContent>
    </Card>
  );
}
