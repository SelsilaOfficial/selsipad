-- Create KYC Documents Storage Bucket
-- Private bucket for encrypted KYC document storage

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Disable RLS (we handle auth at application level)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Alternative: If RLS must be enabled, use this policy instead
-- (Commented out since we're using wallet-only auth without auth.uid())
/*
CREATE POLICY "Authenticated users can upload KYC docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-documents');

CREATE POLICY "Users can view own KYC docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
*/
