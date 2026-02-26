

## Problem

All marketing tables (`influencers`, `influencer_deals`, `influencer_deal_skus`, `ugc_creators`, `ugc_orders`, `external_marketing`) have RLS policies that only allow access to `authenticated` users. You're currently not logged in, so the `anon` role is being used, which gets rejected.

## Fix

Add permissive RLS policies for the `anon` role on all 6 marketing tables so the ERP works without authentication (matching the pattern used by other tables like `orders`, `products`, etc.).

### Migration SQL

```sql
-- Allow anon access to marketing tables (matches existing ERP pattern)
CREATE POLICY "anon_influencers_all" ON public.influencers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_influencer_deals_all" ON public.influencer_deals FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_influencer_deal_skus_all" ON public.influencer_deal_skus FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_ugc_creators_all" ON public.ugc_creators FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_ugc_orders_all" ON public.ugc_orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_external_marketing_all" ON public.external_marketing FOR ALL TO anon USING (true) WITH CHECK (true);
```

Single migration, no code changes needed. After this, adding influencers and all other marketing operations will work immediately.

