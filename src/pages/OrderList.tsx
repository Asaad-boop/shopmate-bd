import { OrderListPage } from "@/components/order-list/OrderListPage";
import { usePageTitle } from "@/hooks/use-page-title";

export default function OrderList() {
  usePageTitle("Order List");
  return <OrderListPage />;
}
