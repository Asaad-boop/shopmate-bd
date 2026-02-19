
-- Allow all access to orders table (no auth yet)
CREATE POLICY "Allow all access to orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- Allow all access to order_items table
CREATE POLICY "Allow all access to order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- Allow all access to customers table
CREATE POLICY "Allow all access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- Allow all access to notifications table
CREATE POLICY "Allow all access to notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
