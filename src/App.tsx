import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Index";
import OrdersPage from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import ProductsPage from "./pages/Products";
import NewProduct from "./pages/NewProduct";
import OrderDetail from "./pages/OrderDetail";
import WebOrdersPage from "./pages/WebOrders";
import WebOrderDetail from "./pages/WebOrderDetail";
import SettingsPage from "./pages/Settings";
import InventoryPage from "./pages/Inventory";
import SystemHealth from "./pages/SystemHealth";
import PurchaseOrdersPage from "./pages/PurchaseOrders";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetail";
import SuppliersPage from "./pages/Suppliers";
import AgentsPage from "./pages/Agents";
import ImportDashboard from "./pages/ImportDashboard";
import CRMPage from "./pages/CRM";
import FinancePage from "./pages/Finance";
import ReportsPage from "./pages/Reports";
import AccountsPage from "./pages/Accounts";
import ExpensesPage from "./pages/Expenses";
import CourierCODPage from "./pages/CourierCOD";
import AuditLogsPage from "./pages/AuditLogs";
import ReportsPnLPage from "./pages/ReportsPnL";
import ReportsCashflowPage from "./pages/ReportsCashflow";
import ReportsStockPage from "./pages/ReportsStock";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/web-orders" element={<WebOrdersPage />} />
            <Route path="/web-orders/:id" element={<WebOrderDetail />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<NewProduct />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/purchase-orders/new" element={<PurchaseOrderDetailPage />} />
            <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/import-dashboard" element={<ImportDashboard />} />
            <Route path="/crm" element={<CRMPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/courier" element={<CourierCODPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/reports/pnl" element={<ReportsPnLPage />} />
            <Route path="/reports/cashflow" element={<ReportsCashflowPage />} />
            <Route path="/reports/stock" element={<ReportsStockPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/system-health" element={<SystemHealth />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
