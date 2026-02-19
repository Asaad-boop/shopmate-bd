
-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-assets', 'company-assets', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/svg+xml']);

-- Allow public read access
CREATE POLICY "Public read access for company assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

-- Allow authenticated or anon upload/update/delete (since no auth in this app)
CREATE POLICY "Allow upload to company assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Allow update company assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'company-assets');

CREATE POLICY "Allow delete company assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-assets');
