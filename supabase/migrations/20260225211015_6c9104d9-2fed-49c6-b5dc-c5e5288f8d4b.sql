
-- ═══════════════════════════════════════════════════
-- MARKETING MODULE: Tables, RLS, and Dashboard RPC
-- ═══════════════════════════════════════════════════

-- 1) Influencers
CREATE TABLE IF NOT EXISTS public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'facebook',
  page_link text,
  contact_info text,
  niche text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "influencers_all" ON public.influencers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) Influencer Deals
CREATE TABLE IF NOT EXISTS public.influencer_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  revenue_generated numeric(14,2) DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  proof_url text,
  notes text,
  posting_event_id uuid REFERENCES public.posting_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.influencer_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "influencer_deals_all" ON public.influencer_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) Influencer Deal SKUs (M2M)
CREATE TABLE IF NOT EXISTS public.influencer_deal_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.influencer_deals(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  allocation_pct numeric(5,2) DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_id, product_id)
);
ALTER TABLE public.influencer_deal_skus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "influencer_deal_skus_all" ON public.influencer_deal_skus FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) UGC Creators
CREATE TABLE IF NOT EXISTS public.ugc_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  content_type text DEFAULT 'product_demo',
  rate_per_video numeric(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ugc_creators_all" ON public.ugc_creators FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) UGC Orders
CREATE TABLE IF NOT EXISTS public.ugc_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  campaign_name text,
  video_count int NOT NULL DEFAULT 1,
  total_cost numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  delivery_status text NOT NULL DEFAULT 'pending',
  payment_status text NOT NULL DEFAULT 'unpaid',
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  proof_url text,
  notes text,
  posting_event_id uuid REFERENCES public.posting_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ugc_orders_all" ON public.ugc_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6) External Marketing Spend
CREATE TABLE IF NOT EXISTS public.external_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'other',
  spend_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  product_id uuid REFERENCES public.products(id),
  campaign_name text,
  notes text,
  posting_event_id uuid REFERENCES public.posting_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.external_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "external_marketing_all" ON public.external_marketing FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7) Marketing Dashboard RPC
CREATE OR REPLACE FUNCTION public.marketing_dashboard_report(
  p_date_from date DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta_spend numeric := 0;
  v_influencer_spend numeric := 0;
  v_ugc_spend numeric := 0;
  v_external_spend numeric := 0;
  v_total_revenue numeric := 0;
BEGIN
  SELECT COALESCE(SUM(amount_bdt), 0) INTO v_meta_spend
  FROM ad_expenses WHERE expense_date BETWEEN p_date_from AND p_date_to;

  SELECT COALESCE(SUM(amount_paid), 0) INTO v_influencer_spend
  FROM influencer_deals WHERE start_date BETWEEN p_date_from AND p_date_to;

  SELECT COALESCE(SUM(amount_paid), 0) INTO v_ugc_spend
  FROM ugc_orders WHERE created_at::date BETWEEN p_date_from AND p_date_to;

  SELECT COALESCE(SUM(amount), 0) INTO v_external_spend
  FROM external_marketing WHERE spend_date BETWEEN p_date_from AND p_date_to;

  SELECT COALESCE(SUM(jl.credit - jl.debit), 0) INTO v_total_revenue
  FROM journal_lines jl
  JOIN chart_of_accounts coa ON coa.id = jl.account_id
  JOIN journal_entries je ON je.id = jl.journal_id
  WHERE coa.account_type = 'income' AND je.status = 'posted'
    AND je.entry_date BETWEEN p_date_from AND p_date_to;

  RETURN jsonb_build_object(
    'meta_spend', v_meta_spend,
    'influencer_spend', v_influencer_spend,
    'ugc_spend', v_ugc_spend,
    'external_spend', v_external_spend,
    'total_spend', v_meta_spend + v_influencer_spend + v_ugc_spend + v_external_spend,
    'total_revenue', v_total_revenue,
    'marketing_ratio', CASE WHEN v_total_revenue > 0 THEN ROUND(((v_meta_spend + v_influencer_spend + v_ugc_spend + v_external_spend) / v_total_revenue) * 100, 2) ELSE 0 END,
    'roi', CASE WHEN (v_meta_spend + v_influencer_spend + v_ugc_spend + v_external_spend) > 0 THEN ROUND((v_total_revenue - (v_meta_spend + v_influencer_spend + v_ugc_spend + v_external_spend)) / (v_meta_spend + v_influencer_spend + v_ugc_spend + v_external_spend) * 100, 2) ELSE 0 END,
    'exceptions', jsonb_build_array(
      jsonb_build_object('type', 'unallocated_deals', 'count', (SELECT COUNT(*) FROM influencer_deals d WHERE d.start_date BETWEEN p_date_from AND p_date_to AND NOT EXISTS (SELECT 1 FROM influencer_deal_skus ds WHERE ds.deal_id = d.id))),
      jsonb_build_object('type', 'overdue_payments', 'count', (SELECT COUNT(*) FROM influencer_deals WHERE payment_status != 'paid' AND start_date < CURRENT_DATE - INTERVAL '15 days')),
      jsonb_build_object('type', 'ugc_delivered_unpaid', 'count', (SELECT COUNT(*) FROM ugc_orders WHERE delivery_status = 'delivered' AND payment_status = 'unpaid'))
    )
  );
END;
$$;
