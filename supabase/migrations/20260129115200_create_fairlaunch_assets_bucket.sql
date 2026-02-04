-- Migration: Create fairlaunch-assets storage bucket
-- Created: 2026-01-29
-- Description: Storage bucket for fairlaunch project images (logos & banners)

-- Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fairlaunch-assets',
  'fairlaunch-assets',
  true, -- Public read access
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
);

-- RLS Policy: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own fairlaunch images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fairlaunch-assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Public read access
CREATE POLICY "Public read access for fairlaunch images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'fairlaunch-assets');

-- RLS Policy: Users can delete their own images
CREATE POLICY "Users can delete their own fairlaunch images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fairlaunch-assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

COMMENT ON TABLE storage.buckets IS 'fairlaunch-assets bucket stores project logos and banners';
