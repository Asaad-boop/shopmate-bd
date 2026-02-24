
-- 1. Meta Ad Accounts
CREATE TABLE meta_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_account_id text UNIQUE NOT NULL,
  account_name text NOT NULL,
  access_token text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Meta Campaigns
CREATE TABLE meta_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_campaign_id text UNIQUE NOT NULL,
  meta_account_id text NOT NULL,
  campaign_name text NOT NULL,
  objective text,
  status text,
  daily_budget numeric,
  lifetime_budget numeric,
  start_date date,
  end_date date,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 3. Daily Campaign Metrics
CREATE TABLE meta_campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES meta_campaigns(id),
  meta_campaign_id text NOT NULL,
  metric_date date NOT NULL,
  spend_usd numeric DEFAULT 0,
  spend_bdt numeric DEFAULT 0,
  usd_rate numeric DEFAULT 110,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  purchases integer DEFAULT 0,
  purchase_value numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  ctr numeric DEFAULT 0,
  roas numeric DEFAULT 0,
  cpo numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(meta_campaign_id, metric_date)
);

-- 4. Campaign-Product mapping
CREATE TABLE campaign_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES meta_campaigns(id),
  product_id uuid REFERENCES products(id),
  allocation_pct numeric DEFAULT 100,
  note text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- 5. Ad Expenses table
CREATE TABLE ad_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  category text NOT NULL DEFAULT 'meta_ads',
  sub_category text,
  amount_bdt numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  exchange_rate numeric DEFAULT 110,
  product_id uuid REFERENCES products(id),
  campaign_id uuid REFERENCES meta_campaigns(id),
  metric_id uuid REFERENCES meta_campaign_metrics(id),
  allocation_type text DEFAULT 'campaign',
  ref_id uuid,
  note text,
  created_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to meta_ad_accounts" ON meta_ad_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to meta_campaigns" ON meta_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to meta_campaign_metrics" ON meta_campaign_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to campaign_products" ON campaign_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to ad_expenses" ON ad_expenses FOR ALL USING (true) WITH CHECK (true);
