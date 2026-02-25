import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { Megaphone, TrendingUp, Users, Video, Globe, AlertTriangle, BarChart3, ArrowRight } from "lucide-react";
import { useMarketingDashboard } from "@/hooks/use-marketing";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("en-BD", { minimumFractionDigits: 0 })}`;

export default function MarketingPage() {
  const nav = useNavigate();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const { data, isLoading } = useMarketingDashboard(dateFrom, dateTo);

  const d = data || {} as any;
  const totalExceptions = ((d.exceptions as any[]) || []).reduce((s: number, e: any) => s + (e.count || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="w-6 h-6 text-primary" /> Marketing</h1>
          <p className="text-sm text-muted-foreground">Track all marketing spend, influencer deals, UGC, and ROI.</p>
        </div>
        <div className="flex items-end gap-3">
          <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" /></div>
        </div>
      </div>

      {/* Exceptions warning */}
      {totalExceptions > 0 && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="font-medium text-destructive">{totalExceptions} marketing exception(s) detected.</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => nav("/exceptions")}>View</Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard title="Total Spend" value={fmt(d.total_spend)} icon={<Megaphone className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Meta Ads" value={fmt(d.meta_spend)} icon={<BarChart3 className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Influencer" value={fmt(d.influencer_spend)} icon={<Users className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="UGC Creators" value={fmt(d.ugc_spend)} icon={<Video className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="External" value={fmt(d.external_spend)} icon={<Globe className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="% of Revenue" value={`${d.marketing_ratio || 0}%`} icon={<TrendingUp className="w-5 h-5" />} loading={isLoading} />
        <KpiCard
          title="ROI"
          value={`${d.roi || 0}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          loading={isLoading}
          className={Number(d.roi) > 0 ? "border-green-500/30" : Number(d.roi) < 0 ? "border-destructive/30" : ""}
        />
      </div>

      {/* Quick Nav Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: "Influencer Deals", desc: "Manage influencer partnerships, payments, and SKU allocation.", icon: Users, href: "/marketing/influencers", color: "text-blue-500" },
          { title: "UGC Creators", desc: "Track video orders, delivery, and creator payments.", icon: Video, href: "/marketing/ugc-creators", color: "text-purple-500" },
          { title: "External Marketing", desc: "SMS, Email, Offline, Agency, and other spend tracking.", icon: Globe, href: "/marketing/external", color: "text-emerald-500" },
        ].map(c => (
          <Card key={c.href} className="p-5 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => nav(c.href)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                  <h3 className="font-semibold">{c.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Card>
        ))}
      </div>

      {/* Exception Details */}
      {d.exceptions && (
        <div className="grid md:grid-cols-3 gap-4">
          {(d.exceptions as any[]).map((ex: any) => (
            <div key={ex.type} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium">{ex.type === "unallocated_deals" ? "Unallocated Deals" : ex.type === "overdue_payments" ? "Overdue Payments (>15d)" : "UGC Delivered Unpaid"}</p>
              </div>
              <Badge variant={ex.count > 0 ? "destructive" : "secondary"}>{ex.count}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
