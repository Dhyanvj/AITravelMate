-- Migration Script for Enhanced Chat Attachments
-- Run this script to update your existing database with enhanced file attachment support

-- Step 1: Add missing columns to chat_attachments table
DO $$ 
BEGIN
    -- Add file_path column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'file_path') THEN
        ALTER TABLE chat_attachments ADD COLUMN file_path TEXT;
        RAISE NOTICE 'Added file_path column to chat_attachments';
    END IF;
    
    -- Add thumbnail_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'thumbnail_url') THEN
        ALTER TABLE chat_attachments ADD COLUMN thumbnail_url TEXT;
        RAISE NOTICE 'Added thumbnail_url column to chat_attachments';
    END IF;
    
    -- Add width column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'width') THEN
        ALTER TABLE chat_attachments ADD COLUMN width INTEGER;
        RAISE NOTICE 'Added width column to chat_attachments';
    END IF;
    
    -- Add height column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'height') THEN
        ALTER TABLE chat_attachments ADD COLUMN height INTEGER;
        RAISE NOTICE 'Added height column to chat_attachments';
    END IF;
    
    -- Add duration column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'duration') THEN
        ALTER TABLE chat_attachments ADD COLUMN duration INTEGER;
        RAISE NOTICE 'Added duration column to chat_attachments';
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'updated_at') THEN
        ALTER TABLE chat_attachments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to chat_attachments';
    END IF;
    
    -- Change file_size to BIGINT if it's currently INTEGER
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_attachments' AND column_name = 'file_size' AND data_type = 'integer') THEN
        ALTER TABLE chat_attachments ALTER COLUMN file_size TYPE BIGINT;
        RAISE NOTICE 'Changed file_size column to BIGINT';
    END IF;
END $$;

-- Step 2: Create enhanced indexes
CREATE INDEX IF NOT EXISTS idx_chat_attachments_file_type ON chat_attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_uploaded_by ON chat_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_created_at ON chat_attachments(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_file_path ON chat_attachments(file_path);

-- Step 3: Update storage bucket configuration
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

-- Step 4: Update storage policies
DROP POLICY IF EXISTS "Users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat files" ON storage.objects;

CREATE POLICY "Users can upload chat files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-files' AND
        auth.uid() IS NOT NULL AND
        (storage.foldername(name))[1] = 'chat-files'
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

-- Step 5: Create helper functions
CREATE OR REPLACE FUNCTION generate_chat_file_path(
    trip_id UUID,
    file_name TEXT,
    file_type TEXT
)
RETURNS TEXT AS $$
DECLARE
    file_extension TEXT;
    timestamp_str TEXT;
    random_str TEXT;
    final_path TEXT;
BEGIN
    -- Extract file extension
    file_extension := COALESCE(
        CASE 
            WHEN position('.' in file_name) > 0 
            THEN substring(file_name from '\.([^.]*)$')
            ELSE ''
        END,
        CASE file_type
            WHEN 'image/jpeg' THEN 'jpg'
            WHEN 'image/png' THEN 'png'
            WHEN 'image/gif' THEN 'gif'
            WHEN 'application/pdf' THEN 'pdf'
            WHEN 'application/msword' THEN 'doc'
            WHEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN 'docx'
            ELSE 'bin'
        END
    );
    
    -- Generate timestamp and random string
    timestamp_str := to_char(now(), 'YYYYMMDDHH24MISS');
    random_str := substring(md5(random()::text) from 1 for 8);
    
    -- Create final path: chat-files/{trip_id}/{timestamp}_{random}.{extension}
    final_path := 'chat-files/' || trip_id::text || '/' || timestamp_str || '_' || random_str || '.' || file_extension;
    
    RETURN final_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create cleanup function for orphaned files
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the file from storage when attachment is deleted
    IF OLD.file_path IS NOT NULL THEN
        DELETE FROM storage.objects 
        WHERE bucket_id = 'chat-files' 
        AND name = OLD.file_path;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger for file cleanup
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_files ON chat_attachments;
CREATE TRIGGER trigger_cleanup_orphaned_files
    AFTER DELETE ON chat_attachments
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_orphaned_files();

-- Step 8: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_attachment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_attachment_updated_at ON chat_attachments;
CREATE TRIGGER trigger_update_attachment_updated_at
    BEFORE UPDATE ON chat_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_attachment_updated_at();

-- Step 9: Create utility views
CREATE OR REPLACE VIEW chat_attachments_with_metadata AS
SELECT 
    ca.*,
    cm.trip_id,
    cm.sender_id,
    cm.created_at as message_created_at,
    p.username as uploaded_by_username,
    p.avatar_url as uploaded_by_avatar
FROM chat_attachments ca
JOIN chat_messages cm ON ca.message_id = cm.id
LEFT JOIN profiles p ON ca.uploaded_by = p.id;

-- Step 10: Grant permissions
GRANT EXECUTE ON FUNCTION generate_chat_file_path(UUID, TEXT, TEXT) TO authenticated;
GRANT SELECT ON chat_attachments_with_metadata TO authenticated;

-- Step 11: Create file statistics function
CREATE OR REPLACE FUNCTION get_trip_file_stats(trip_uuid UUID)
RETURNS TABLE (
    total_files BIGINT,
    total_size BIGINT,
    image_count BIGINT,
    document_count BIGINT,
    video_count BIGINT,
    audio_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_files,
        COALESCE(SUM(ca.file_size), 0) as total_size,
        COUNT(*) FILTER (WHERE ca.file_type LIKE 'image/%') as image_count,
        COUNT(*) FILTER (WHERE ca.file_type LIKE 'application/%' OR ca.file_type LIKE 'text/%') as document_count,
        COUNT(*) FILTER (WHERE ca.file_type LIKE 'video/%') as video_count,
        COUNT(*) FILTER (WHERE ca.file_type LIKE 'audio/%') as audio_count
    FROM chat_attachments ca
    JOIN chat_messages cm ON ca.message_id = cm.id
    WHERE cm.trip_id = trip_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_trip_file_stats(UUID) TO authenticated;

-- Step 12: Create storage cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_chat_files(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    file_record RECORD;
BEGIN
    -- Find files that are older than specified days and not referenced in chat_attachments
    FOR file_record IN 
        SELECT name, created_at
        FROM storage.objects 
        WHERE bucket_id = 'chat-files' 
        AND created_at < NOW() - INTERVAL '1 day' * days_old
        AND name NOT IN (
            SELECT file_path FROM chat_attachments WHERE file_path IS NOT NULL
        )
    LOOP
        -- Delete the file
        DELETE FROM storage.objects 
        WHERE bucket_id = 'chat-files' AND name = file_record.name;
        
        deleted_count := deleted_count + 1;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_old_chat_files(INTEGER) TO authenticated;

-- Step 13: Create storage stats function
CREATE OR REPLACE FUNCTION get_chat_storage_stats(trip_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_files BIGINT,
    total_size BIGINT,
    bucket_name TEXT,
    oldest_file TIMESTAMP WITH TIME ZONE,
    newest_file TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_files,
        COALESCE(SUM(metadata->>'size')::BIGINT, 0) as total_size,
        'chat-files'::TEXT as bucket_name,
        MIN(created_at) as oldest_file,
        MAX(created_at) as newest_file
    FROM storage.objects 
    WHERE bucket_id = 'chat-files'
    AND (trip_id IS NULL OR name LIKE 'chat-files/' || trip_id::text || '/%');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_chat_storage_stats(UUID) TO authenticated;

-- Step 14: Create file management view
CREATE OR REPLACE VIEW chat_files_view AS
SELECT 
    o.name as file_path,
    o.bucket_id,
    o.owner,
    o.created_at as uploaded_at,
    o.updated_at,
    o.metadata,
    ca.id as attachment_id,
    ca.message_id,
    ca.file_name,
    ca.file_type,
    ca.file_size,
    ca.uploaded_by,
    cm.trip_id,
    cm.sender_id,
    p.username as uploaded_by_username
FROM storage.objects o
LEFT JOIN chat_attachments ca ON o.name = ca.file_path
LEFT JOIN chat_messages cm ON ca.message_id = cm.id
LEFT JOIN profiles p ON ca.uploaded_by = p.id
WHERE o.bucket_id = 'chat-files';

GRANT SELECT ON chat_files_view TO authenticated;

-- Step 15: Create indexes for storage objects
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_name ON storage.objects(name);
CREATE INDEX IF NOT EXISTS idx_storage_objects_created_at ON storage.objects(created_at);

-- Migration complete
SELECT 'Chat attachments migration completed successfully!' as status;
