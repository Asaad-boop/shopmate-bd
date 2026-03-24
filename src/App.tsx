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
import { lazy, Suspense } from "react";
import { PageLoadingSkeleton } from "@/components/ui/page-skeleton";
import LoginPage from "./pages/Login";
const Dashboard = lazy(() => import("./pages/Index"));

/* ─── Lazy-loaded pages ─── */
const SearchPage = lazy(() => import("./pages/Search"));
const OrdersPage = lazy(() => import("./pages/Orders"));
const OrderListPage = lazy(() => import("./components/order-list/OrderListPage").then(m => ({ default: m.OrderListPage })));
const NewOrder = lazy(() => import("./pages/NewOrder"));
const ApprovedOrders = lazy(() => import("./pages/ApprovedOrders"));
const AllOrders = lazy(() => import("./pages/AllOrders"));
const PreOrderList = lazy(() => import("./pages/PreOrderList"));
const ScanToUpdate = lazy(() => import("./pages/ScanToUpdate"));
const OldOrdersPage = lazy(() => import("./pages/OldOrders"));
const SuperEdit = lazy(() => import("./pages/SuperEdit"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const WebOrdersPage = lazy(() => import("./pages/WebOrders"));
const WebOrderDetail = lazy(() => import("./pages/WebOrderDetail"));
const FakeOrderReports = lazy(() => import("./pages/FakeOrderReports"));
const ProductsPage = lazy(() => import("./pages/Products"));
const NewProduct = lazy(() => import("./pages/NewProduct"));
const InventoryPage = lazy(() => import("./pages/Inventory"));
const CategoryBrand = lazy(() => import("./pages/CategoryBrand"));
const WarrantyPage = lazy(() => import("./pages/Warranty"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const SystemHealth = lazy(() => import("./pages/SystemHealth"));
const PurchaseOrdersPage = lazy(() => import("./pages/PurchaseOrders"));
const PurchaseOrderDetailPage = lazy(() => import("./pages/PurchaseOrderDetail"));
const SuppliersPage = lazy(() => import("./pages/Suppliers"));
const AgentsPage = lazy(() => import("./pages/Agents"));
const ImportDashboard = lazy(() => import("./pages/ImportDashboard"));
const ImportManagement = lazy(() => import("./pages/ImportManagement"));
const PurchasingPage = lazy(() => import("./pages/Purchasing"));
const ProcurementDashboard = lazy(() => import("./pages/Procurement"));
const CRMPage = lazy(() => import("./pages/CRM"));
const FinancePage = lazy(() => import("./pages/Finance"));
const FinanceAccountsPage = lazy(() => import("./pages/FinanceAccounts"));
const PostingQueue = lazy(() => import("./pages/PostingQueue"));
const FinanceSettlementsPage = lazy(() => import("./pages/FinanceSettlements"));
const FinancePayablesPage = lazy(() => import("./pages/FinancePayables"));
const FinanceLedgerPage = lazy(() => import("./pages/FinanceLedger"));
const HRMPage = lazy(() => import("./pages/HRM"));
const MetaAdsReport = lazy(() => import("./pages/MetaAdsReport"));
const MetaAdsCampaignProducts = lazy(() => import("./pages/MetaAdsCampaignProducts"));
const ReportsPage = lazy(() => import("./pages/Reports"));
const ReportsExecutivePage = lazy(() => import("./pages/ReportsExecutive"));
const ReportsPnL = lazy(() => import("./pages/ReportsPnL"));
const ReportsCashflow = lazy(() => import("./pages/ReportsCashflow"));
const ReportsSKUProfit = lazy(() => import("./pages/ReportsSKUProfit"));
const ReportsInventoryValuation = lazy(() => import("./pages/ReportsInventoryValuation"));
const ReportsCourierPerformance = lazy(() => import("./pages/ReportsCourierPerformance"));
const ReportsBalance = lazy(() => import("./pages/ReportsBalance"));
const ReportsExpenseAnalytics = lazy(() => import("./pages/ReportsExpenseAnalytics"));
const AccountingPage = lazy(() => import("./pages/Accounting"));
const CourierCODPage = lazy(() => import("./pages/CourierCOD"));
const ExpensesPage = lazy(() => import("./pages/Expenses"));
const ExceptionsPage = lazy(() => import("./pages/Exceptions"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogs"));
const RolesPermissionsPage = lazy(() => import("./pages/RolesPermissions"));
const ImportLegacyOrders = lazy(() => import("./pages/ImportLegacyOrders"));
const LegacyBatches = lazy(() => import("./pages/LegacyBatches"));
const MarketingPage = lazy(() => import("./pages/Marketing"));
const MarketingInfluencersPage = lazy(() => import("./pages/MarketingInfluencers"));
const MarketingUGCPage = lazy(() => import("./pages/MarketingUGC"));
const MarketingExternalPage = lazy(() => import("./pages/MarketingExternal"));
const ExchangesPage = lazy(() => import("./pages/Exchanges"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

function E({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return (
    <E>
      <Suspense fallback={<PageFallback />}>
        {children}
      </Suspense>
    </E>
  );
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
            <Route path="/login" element={<LoginPage />} />

            <Route element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<E><Dashboard /></E>} />
                <Route path="/search" element={<L><SearchPage /></L>} />

                {/* Orders */}
                <Route path="/orders" element={<L><OrdersPage /></L>} />
                <Route path="/orders/approved" element={<L><ApprovedOrders /></L>} />
                <Route path="/orders/list" element={<L><OrderListPage /></L>} />
                <Route path="/orders/new" element={<L><NewOrder /></L>} />
                <Route path="/orders/all" element={<L><AllOrders /></L>} />
                <Route path="/orders/old" element={<L><OldOrdersPage /></L>} />
                <Route path="/orders/super-edit" element={<L><SuperEdit /></L>} />
                <Route path="/orders/pre-orders" element={<L><PreOrderList /></L>} />
                <Route path="/orders/preorders" element={<L><PreOrderList /></L>} />
                <Route path="/orders/scan" element={<L><ScanToUpdate /></L>} />
                <Route path="/orders/import-legacy" element={<L><ImportLegacyOrders /></L>} />
                <Route path="/orders/legacy-batches" element={<L><LegacyBatches /></L>} />
                <Route path="/orders/:id" element={<L><OrderDetail /></L>} />
                <Route path="/exchanges" element={<L><ExchangesPage /></L>} />

                {/* Web Orders */}
                <Route path="/web-orders" element={<L><WebOrdersPage /></L>} />
                <Route path="/web-orders/fake-reports" element={<L><FakeOrderReports /></L>} />
                <Route path="/web-orders/:id" element={<L><WebOrderDetail /></L>} />

                {/* Products & Inventory */}
                <Route path="/products" element={<L><ProductsPage /></L>} />
                <Route path="/products/new" element={<L><NewProduct /></L>} />
                <Route path="/inventory" element={<L><InventoryPage /></L>} />
                <Route path="/inventory/categories" element={<L><CategoryBrand /></L>} />
                <Route path="/inventory/warranty" element={<L><WarrantyPage /></L>} />

                {/* Meta Ads */}
                <Route path="/meta-ads/report" element={<L><MetaAdsReport /></L>} />
                <Route path="/meta-ads/campaign-products" element={<L><MetaAdsCampaignProducts /></L>} />

                {/* Finance */}
                <Route path="/finance" element={<L><FinancePage /></L>} />
                <Route path="/finance/accounts" element={<L><FinanceAccountsPage /></L>} />
                <Route path="/finance/posting-queue" element={<L><PostingQueue /></L>} />
                <Route path="/finance/posting" element={<L><PostingQueue /></L>} />
                <Route path="/finance/settlements" element={<L><FinanceSettlementsPage /></L>} />
                <Route path="/finance/payables" element={<L><FinancePayablesPage /></L>} />
                <Route path="/finance/ledger" element={<L><FinanceLedgerPage /></L>} />
                <Route path="/accounting" element={<L><AccountingPage /></L>} />
                <Route path="/courier-cod" element={<L><CourierCODPage /></L>} />
                <Route path="/expenses" element={<L><ExpensesPage /></L>} />

                {/* Procurement */}
                <Route path="/procurement" element={<L><ProcurementDashboard /></L>} />
                <Route path="/purchasing" element={<L><PurchasingPage /></L>} />
                <Route path="/purchase-orders" element={<L><PurchaseOrdersPage /></L>} />
                <Route path="/purchase-orders/new" element={<L><PurchaseOrderDetailPage /></L>} />
                <Route path="/purchase-orders/:id" element={<L><PurchaseOrderDetailPage /></L>} />
                <Route path="/suppliers" element={<L><SuppliersPage /></L>} />
                <Route path="/agents" element={<L><AgentsPage /></L>} />
                <Route path="/import-dashboard" element={<L><ImportDashboard /></L>} />
                <Route path="/imports" element={<L><ImportManagement /></L>} />

                {/* CRM & HRM */}
                <Route path="/crm" element={<L><CRMPage /></L>} />
                <Route path="/hrm" element={<L><HRMPage /></L>} />
                <Route path="/hrm/employees" element={<L><HRMPage /></L>} />
                <Route path="/hrm/attendance" element={<L><HRMPage /></L>} />
                <Route path="/hrm/payroll" element={<L><HRMPage /></L>} />
                <Route path="/hrm/performance" element={<L><HRMPage /></L>} />
                <Route path="/hrm/leave" element={<L><HRMPage /></L>} />
                <Route path="/hrm/tasks" element={<L><HRMPage /></L>} />

                {/* Reports */}
                <Route path="/reports" element={<L><ReportsPage /></L>} />
                <Route path="/reports/executive" element={<L><ReportsExecutivePage /></L>} />
                <Route path="/reports/pnl" element={<L><ReportsPnL /></L>} />
                <Route path="/reports/cashflow" element={<L><ReportsCashflow /></L>} />
                <Route path="/reports/sku-profit" element={<L><ReportsSKUProfit /></L>} />
                <Route path="/reports/inventory-valuation" element={<L><ReportsInventoryValuation /></L>} />
                <Route path="/reports/courier-performance" element={<L><ReportsCourierPerformance /></L>} />
                <Route path="/reports/balance" element={<L><ReportsBalance /></L>} />
                <Route path="/reports/expense-analytics" element={<L><ReportsExpenseAnalytics /></L>} />

                {/* System */}
                <Route path="/security/roles" element={<L><RolesPermissionsPage /></L>} />
                <Route path="/security/audit-logs" element={<L><AuditLogsPage /></L>} />
                <Route path="/exceptions" element={<L><ExceptionsPage /></L>} />
                <Route path="/settings" element={<L><SettingsPage /></L>} />
                <Route path="/system-health" element={<L><SystemHealth /></L>} />
                <Route path="/marketing" element={<L><MarketingPage /></L>} />
                <Route path="/marketing/influencers" element={<L><MarketingInfluencersPage /></L>} />
                <Route path="/marketing/ugc-creators" element={<L><MarketingUGCPage /></L>} />
                <Route path="/marketing/external" element={<L><MarketingExternalPage /></L>} />

                <Route path="/customers" element={<Navigate to="/crm" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<L><NotFound /></L>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
