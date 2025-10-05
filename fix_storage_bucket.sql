-- Fix Supabase Storage Bucket Configuration
-- Run this script in your Supabase SQL Editor

-- Step 1: Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
    'chat-files', 
    'chat-files', 
    true, 
    52428800, -- 50MB limit
    ARRAY[
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed',
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'audio/mpeg', 'audio/wav'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Step 2: Drop existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat files" ON storage.objects;

-- Step 3: Create new storage policies
CREATE POLICY "Users can upload chat files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-files' AND
        auth.uid() IS NOT NULL
    );

CREATE POLICY "Users can view chat files" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-files');

CREATE POLICY "Users can update their own chat files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'chat-files' AND
        owner = auth.uid()
    );

CREATE POLICY "Users can delete their own chat files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'chat-files' AND
        owner = auth.uid()
    );

-- Step 4: Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Step 5: Test the bucket exists
SELECT * FROM storage.buckets WHERE id = 'chat-files';
