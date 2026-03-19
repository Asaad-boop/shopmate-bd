import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Package, Loader2, AlertCircle, Eye, EyeOff,
  ShoppingCart, Wallet, BarChart2,
} from "lucide-react";

const FEATURES = [
  { icon: ShoppingCart, label: "Orders & Inventory", desc: "Full order lifecycle with multi-courier support" },
  { icon: Wallet, label: "Finance & Accounting", desc: "Double-entry ledger with automated posting" },
  { icon: BarChart2, label: "Reports & Analytics", desc: "Executive dashboards and SKU profitability" },
];

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) setError("Invalid email or password. Please try again.");
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ─── Left Panel (desktop only) ─── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between p-10 bg-slate-900 text-white relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-slate-900" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/10 blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">ShopMate BD</span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Your complete e-commerce ERP</p>
        </div>

        <div className="relative z-10 space-y-6">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center shrink-0 mt-0.5">
                <f.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">{f.label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} ShopMate BD • v1.0
        </p>
      </div>

      {/* ─── Right Panel (login form) ─── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <Package className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">ShopMate BD</span>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your workspace</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="text-sm text-muted-foreground font-normal cursor-pointer">
                Remember me
              </Label>
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sign In
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Protected workspace — Admin access only
          </p>
        </div>
      </div>
    </div>
  );
}
