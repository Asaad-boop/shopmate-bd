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
