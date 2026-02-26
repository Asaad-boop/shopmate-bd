-- Allow anon access to marketing tables (matches existing ERP pattern)
CREATE POLICY "anon_influencers_all" ON public.influencers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_influencer_deals_all" ON public.influencer_deals FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_influencer_deal_skus_all" ON public.influencer_deal_skus FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_ugc_creators_all" ON public.ugc_creators FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_ugc_orders_all" ON public.ugc_orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_external_marketing_all" ON public.external_marketing FOR ALL TO anon USING (true) WITH CHECK (true);