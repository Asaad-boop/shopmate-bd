import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Index";
import SearchPage from "./pages/Search";
import OrdersPage from "./pages/Orders";
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
import PurchasingPage from "./pages/Purchasing";
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
            {/* Dashboard & Search */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<SearchPage />} />

            {/* Orders */}
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/approved" element={<ApprovedOrders />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders/all" element={<AllOrders />} />
            <Route path="/orders/old" element={<OldOrdersPage />} />
            <Route path="/orders/super-edit" element={<SuperEdit />} />
            <Route path="/orders/pre-orders" element={<PreOrderList />} />
            <Route path="/orders/preorders" element={<PreOrderList />} />
            <Route path="/orders/scan" element={<ScanToUpdate />} />
            <Route path="/orders/import-legacy" element={<ImportLegacyOrders />} />
            <Route path="/orders/legacy-batches" element={<LegacyBatches />} />
            <Route path="/orders/:id" element={<OrderDetail />} />

            {/* Web Orders */}
            <Route path="/web-orders" element={<WebOrdersPage />} />
            <Route path="/web-orders/fake-reports" element={<FakeOrderReports />} />
            <Route path="/web-orders/:id" element={<WebOrderDetail />} />

            {/* Inventory & Products */}
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<NewProduct />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/inventory/categories" element={<CategoryBrand />} />
            <Route path="/inventory/warranty" element={<WarrantyPage />} />

            {/* Meta Ads */}
            <Route path="/meta-ads/report" element={<MetaAdsReport />} />
            <Route path="/meta-ads/campaign-products" element={<MetaAdsCampaignProducts />} />

            {/* Account & Finance */}
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/finance/accounts" element={<FinanceAccountsPage />} />
            <Route path="/finance/posting-queue" element={<PostingQueue />} />
            <Route path="/finance/posting" element={<PostingQueue />} />
            <Route path="/finance/settlements" element={<FinanceSettlementsPage />} />
            <Route path="/finance/payables" element={<FinancePayablesPage />} />
            <Route path="/finance/ledger" element={<FinanceLedgerPage />} />
            <Route path="/accounting" element={<AccountingPage />} />
            <Route path="/courier-cod" element={<CourierCODPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />

            {/* Imports & Goods Purchase */}
            <Route path="/purchasing" element={<PurchasingPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/purchase-orders/new" element={<PurchaseOrderDetailPage />} />
            <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/import-dashboard" element={<ImportDashboard />} />

            {/* HRM, CRM */}
            <Route path="/crm" element={<CRMPage />} />
            <Route path="/hrm" element={<HRMPage />} />
            <Route path="/hrm/employees" element={<HRMPage />} />
            <Route path="/hrm/attendance" element={<HRMPage />} />
            <Route path="/hrm/payroll" element={<HRMPage />} />
            <Route path="/hrm/performance" element={<HRMPage />} />
            <Route path="/hrm/leave" element={<HRMPage />} />
            <Route path="/hrm/tasks" element={<HRMPage />} />

            {/* Reports */}
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/executive" element={<ReportsExecutivePage />} />
            <Route path="/reports/pnl" element={<ReportsPnL />} />
            <Route path="/reports/cashflow" element={<ReportsCashflow />} />
            <Route path="/reports/sku-profit" element={<ReportsSKUProfit />} />
            <Route path="/reports/inventory-valuation" element={<ReportsInventoryValuation />} />
            <Route path="/reports/courier-performance" element={<ReportsCourierPerformance />} />
            <Route path="/reports/balance" element={<ReportsBalance />} />
            <Route path="/reports/expense-analytics" element={<ReportsExpenseAnalytics />} />

            {/* Access */}
            <Route path="/security/roles" element={<RolesPermissionsPage />} />
            <Route path="/security/audit-logs" element={<AuditLogsPage />} />
            <Route path="/exceptions" element={<ExceptionsPage />} />

            {/* System */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/system-health" element={<SystemHealth />} />
            <Route path="/marketing" element={<MarketingPage />} />
            <Route path="/marketing/influencers" element={<MarketingInfluencersPage />} />
            <Route path="/marketing/ugc-creators" element={<MarketingUGCPage />} />
            <Route path="/marketing/external" element={<MarketingExternalPage />} />

            {/* Redirects for old routes */}
            <Route path="/customers" element={<Navigate to="/crm" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
