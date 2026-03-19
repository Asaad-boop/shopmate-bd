import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Index";
import SearchPage from "./pages/Search";
import OrdersPage from "./pages/Orders";
import { OrderListPage } from "./components/order-list/OrderListPage";
import NewOrder from "./pages/NewOrder";
import ApprovedOrders from "./pages/ApprovedOrders";
import AllOrders from "./pages/AllOrders";
import PreOrderList from "./pages/PreOrderList";
import ScanToUpdate from "./pages/ScanToUpdate";
import OldOrdersPage from "./pages/OldOrders";
import SuperEdit from "./pages/SuperEdit";
import OrderDetail from "./pages/OrderDetail";
import WebOrdersPage from "./pages/WebOrders";
import WebOrderDetail from "./pages/WebOrderDetail";
import FakeOrderReports from "./pages/FakeOrderReports";
import ProductsPage from "./pages/Products";
import NewProduct from "./pages/NewProduct";
import InventoryPage from "./pages/Inventory";
import CategoryBrand from "./pages/CategoryBrand";
import WarrantyPage from "./pages/Warranty";
import SettingsPage from "./pages/Settings";
import SystemHealth from "./pages/SystemHealth";
import PurchaseOrdersPage from "./pages/PurchaseOrders";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetail";
import SuppliersPage from "./pages/Suppliers";
import AgentsPage from "./pages/Agents";
import ImportDashboard from "./pages/ImportDashboard";
import ImportManagement from "./pages/ImportManagement";
import PurchasingPage from "./pages/Purchasing";
import ProcurementDashboard from "./pages/Procurement";
import CRMPage from "./pages/CRM";
import FinancePage from "./pages/Finance";
import FinanceAccountsPage from "./pages/FinanceAccounts";
import PostingQueue from "./pages/PostingQueue";
import FinanceSettlementsPage from "./pages/FinanceSettlements";
import FinancePayablesPage from "./pages/FinancePayables";
import FinanceLedgerPage from "./pages/FinanceLedger";
import HRMPage from "./pages/HRM";
import MetaAdsReport from "./pages/MetaAdsReport";
import MetaAdsCampaignProducts from "./pages/MetaAdsCampaignProducts";
import ReportsPage from "./pages/Reports";
import ReportsExecutivePage from "./pages/ReportsExecutive";
import ReportsPnL from "./pages/ReportsPnL";
import ReportsCashflow from "./pages/ReportsCashflow";
import ReportsSKUProfit from "./pages/ReportsSKUProfit";
import ReportsInventoryValuation from "./pages/ReportsInventoryValuation";
import ReportsCourierPerformance from "./pages/ReportsCourierPerformance";
import ReportsBalance from "./pages/ReportsBalance";
import ReportsExpenseAnalytics from "./pages/ReportsExpenseAnalytics";
import AccountingPage from "./pages/Accounting";
import CourierCODPage from "./pages/CourierCOD";
import ExpensesPage from "./pages/Expenses";
import ExceptionsPage from "./pages/Exceptions";
import AuditLogsPage from "./pages/AuditLogs";
import RolesPermissionsPage from "./pages/RolesPermissions";
import ImportLegacyOrders from "./pages/ImportLegacyOrders";
import LegacyBatches from "./pages/LegacyBatches";
import MarketingPage from "./pages/Marketing";
import MarketingInfluencersPage from "./pages/MarketingInfluencers";
import MarketingUGCPage from "./pages/MarketingUGC";
import MarketingExternalPage from "./pages/MarketingExternal";
import ExchangesPage from "./pages/Exchanges";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Wrap page component with ErrorBoundary */
function E({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected */}
            <Route element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                {/* Dashboard & Search */}
                <Route path="/" element={<E><Dashboard /></E>} />
                <Route path="/search" element={<E><SearchPage /></E>} />

                {/* Orders */}
                <Route path="/orders" element={<E><OrdersPage /></E>} />
                <Route path="/orders/approved" element={<E><ApprovedOrders /></E>} />
                <Route path="/orders/list" element={<E><OrderListPage /></E>} />
                <Route path="/orders/new" element={<E><NewOrder /></E>} />
                <Route path="/orders/all" element={<E><AllOrders /></E>} />
                <Route path="/orders/old" element={<E><OldOrdersPage /></E>} />
                <Route path="/orders/super-edit" element={<E><SuperEdit /></E>} />
                <Route path="/orders/pre-orders" element={<E><PreOrderList /></E>} />
                <Route path="/orders/preorders" element={<E><PreOrderList /></E>} />
                <Route path="/orders/scan" element={<E><ScanToUpdate /></E>} />
                <Route path="/orders/import-legacy" element={<E><ImportLegacyOrders /></E>} />
                <Route path="/orders/legacy-batches" element={<E><LegacyBatches /></E>} />
                <Route path="/orders/:id" element={<E><OrderDetail /></E>} />
                <Route path="/exchanges" element={<E><ExchangesPage /></E>} />

                {/* Web Orders */}
                <Route path="/web-orders" element={<E><WebOrdersPage /></E>} />
                <Route path="/web-orders/fake-reports" element={<E><FakeOrderReports /></E>} />
                <Route path="/web-orders/:id" element={<E><WebOrderDetail /></E>} />

                {/* Inventory & Products */}
                <Route path="/products" element={<E><ProductsPage /></E>} />
                <Route path="/products/new" element={<E><NewProduct /></E>} />
                <Route path="/inventory" element={<E><InventoryPage /></E>} />
                <Route path="/inventory/categories" element={<E><CategoryBrand /></E>} />
                <Route path="/inventory/warranty" element={<E><WarrantyPage /></E>} />

                {/* Meta Ads */}
                <Route path="/meta-ads/report" element={<E><MetaAdsReport /></E>} />
                <Route path="/meta-ads/campaign-products" element={<E><MetaAdsCampaignProducts /></E>} />

                {/* Account & Finance */}
                <Route path="/finance" element={<E><FinancePage /></E>} />
                <Route path="/finance/accounts" element={<E><FinanceAccountsPage /></E>} />
                <Route path="/finance/posting-queue" element={<E><PostingQueue /></E>} />
                <Route path="/finance/posting" element={<E><PostingQueue /></E>} />
                <Route path="/finance/settlements" element={<E><FinanceSettlementsPage /></E>} />
                <Route path="/finance/payables" element={<E><FinancePayablesPage /></E>} />
                <Route path="/finance/ledger" element={<E><FinanceLedgerPage /></E>} />
                <Route path="/accounting" element={<E><AccountingPage /></E>} />
                <Route path="/courier-cod" element={<E><CourierCODPage /></E>} />
                <Route path="/expenses" element={<E><ExpensesPage /></E>} />

                {/* Imports & Goods Purchase */}
                <Route path="/procurement" element={<E><ProcurementDashboard /></E>} />
                <Route path="/purchasing" element={<E><PurchasingPage /></E>} />
                <Route path="/purchase-orders" element={<E><PurchaseOrdersPage /></E>} />
                <Route path="/purchase-orders/new" element={<E><PurchaseOrderDetailPage /></E>} />
                <Route path="/purchase-orders/:id" element={<E><PurchaseOrderDetailPage /></E>} />
                <Route path="/suppliers" element={<E><SuppliersPage /></E>} />
                <Route path="/agents" element={<E><AgentsPage /></E>} />
                <Route path="/import-dashboard" element={<E><ImportDashboard /></E>} />
                <Route path="/imports" element={<E><ImportManagement /></E>} />

                {/* HRM, CRM */}
                <Route path="/crm" element={<E><CRMPage /></E>} />
                <Route path="/hrm" element={<E><HRMPage /></E>} />
                <Route path="/hrm/employees" element={<E><HRMPage /></E>} />
                <Route path="/hrm/attendance" element={<E><HRMPage /></E>} />
                <Route path="/hrm/payroll" element={<E><HRMPage /></E>} />
                <Route path="/hrm/performance" element={<E><HRMPage /></E>} />
                <Route path="/hrm/leave" element={<E><HRMPage /></E>} />
                <Route path="/hrm/tasks" element={<E><HRMPage /></E>} />

                {/* Reports */}
                <Route path="/reports" element={<E><ReportsPage /></E>} />
                <Route path="/reports/executive" element={<E><ReportsExecutivePage /></E>} />
                <Route path="/reports/pnl" element={<E><ReportsPnL /></E>} />
                <Route path="/reports/cashflow" element={<E><ReportsCashflow /></E>} />
                <Route path="/reports/sku-profit" element={<E><ReportsSKUProfit /></E>} />
                <Route path="/reports/inventory-valuation" element={<E><ReportsInventoryValuation /></E>} />
                <Route path="/reports/courier-performance" element={<E><ReportsCourierPerformance /></E>} />
                <Route path="/reports/balance" element={<E><ReportsBalance /></E>} />
                <Route path="/reports/expense-analytics" element={<E><ReportsExpenseAnalytics /></E>} />

                {/* Access */}
                <Route path="/security/roles" element={<E><RolesPermissionsPage /></E>} />
                <Route path="/security/audit-logs" element={<E><AuditLogsPage /></E>} />
                <Route path="/exceptions" element={<E><ExceptionsPage /></E>} />

                {/* System */}
                <Route path="/settings" element={<E><SettingsPage /></E>} />
                <Route path="/system-health" element={<E><SystemHealth /></E>} />
                <Route path="/marketing" element={<E><MarketingPage /></E>} />
                <Route path="/marketing/influencers" element={<E><MarketingInfluencersPage /></E>} />
                <Route path="/marketing/ugc-creators" element={<E><MarketingUGCPage /></E>} />
                <Route path="/marketing/external" element={<E><MarketingExternalPage /></E>} />

                {/* Redirects */}
                <Route path="/customers" element={<Navigate to="/crm" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
