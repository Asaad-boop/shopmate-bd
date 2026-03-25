
-- Note presets table
CREATE TABLE IF NOT EXISTS public.note_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  icon text,
  note_text text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.note_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_note_presets_all" ON public.note_presets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_note_presets_all" ON public.note_presets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default presets
INSERT INTO public.note_presets (label, icon, note_text, display_order) VALUES
('Called — No Answer', '📞', 'Called customer — no answer', 1),
('Called — Busy', '📞', 'Called customer — line busy', 2),
('Called — Confirmed', '✅', 'Called customer — order confirmed', 3),
('Call Later', '🔄', 'Customer requested callback later', 4),
('Wrong Number', '❌', 'Wrong number — cannot reach customer', 5),
('Address Issue', '📦', 'Address unclear — needs verification', 6),
('WhatsApp Sent', '💬', 'WhatsApp message sent to customer', 7),
('Requested Delay', '⏰', 'Customer requested delivery delay', 8);

-- Go-live progress table
CREATE TABLE IF NOT EXISTS public.go_live_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_name text NOT NULL UNIQUE,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.go_live_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_go_live_progress_all" ON public.go_live_progress FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_go_live_progress_all" ON public.go_live_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default steps
INSERT INTO public.go_live_progress (step_name) VALUES
('company_setup'),
('product_setup'),
('opening_stock'),
('opening_balances'),
('historical_sales'),
('go_live_checklist'),
('launch');
