import { ScanMode } from "@/components/orders/ScanMode";
import { toast } from "sonner";

export default function ScanToUpdate() {
  const handleStatusChange = (orderId: string, orderNumber: string, newStatus: string) => {
    toast.success(`Order ${orderNumber} → ${newStatus}`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Scan to Update</h1>
      <ScanMode onStatusChange={handleStatusChange} />
    </div>
  );
}
