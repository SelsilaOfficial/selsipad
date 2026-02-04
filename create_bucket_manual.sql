-- Fix RLS Policies for fairlaunch-assets bucket
-- Run in Supabase SQL Editor

-- First, ensure bucket exists and is public
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
WHERE id = 'fairlaunch-assets';

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload their own fairlaunch images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for fairlaunch images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own fairlaunch images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to fairlaunch-assets" ON storage.objects;

-- Create simplified upload policy for authenticated users
CREATE POLICY "Authenticated users can upload to fairlaunch-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fairlaunch-assets');

-- Public read access
CREATE POLICY "Public read access for fairlaunch images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'fairlaunch-assets');

-- Delete policy (users can delete their own files)
CREATE POLICY "Users can delete their own fairlaunch images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fairlaunch-assets' AND
  owner = auth.uid()
);
