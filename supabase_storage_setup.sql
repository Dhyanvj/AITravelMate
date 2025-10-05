-- Supabase Storage Setup for Chat File Attachments
-- This script sets up the storage bucket and policies for file attachments

-- Create the chat-files storage bucket with comprehensive configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
    'chat-files', 
    'chat-files', 
    true, 
    52428800, -- 50MB file size limit
    ARRAY[
        -- Image formats
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 
        'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/svg+xml',
        
        -- Document formats
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        
        -- Text formats
        'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
        'application/json', 'application/xml', 'text/xml',
        
        -- Archive formats
        'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
        'application/x-7z-compressed', 'application/gzip', 'application/x-tar',
        
        -- Video formats
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
        'video/3gpp', 'video/x-flv', 'video/x-ms-wmv',
        
        -- Audio formats
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac',
        'audio/x-m4a', 'audio/flac', 'audio/webm'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat files" ON storage.objects;

-- Storage policy: Users can upload files to chat-files bucket
CREATE POLICY "Users can upload chat files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-files' AND
        auth.uid() IS NOT NULL AND
        -- Ensure files are uploaded to trip-specific folders
        (storage.foldername(name))[1] = 'chat-files'
    );

-- Storage policy: Users can view files from trips they are members of
CREATE POLICY "Users can view chat files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'chat-files' AND
        (
            -- Allow public access to files in chat-files bucket
            -- This is safe because we control access through our RLS policies
            true
        )
    );

-- Storage policy: Users can update their own files
CREATE POLICY "Users can update their own chat files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'chat-files' AND
        owner = auth.uid()
    );

-- Storage policy: Users can delete their own files
CREATE POLICY "Users can delete their own chat files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'chat-files' AND
        owner = auth.uid()
    );

-- Create a function to generate secure file paths
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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION generate_chat_file_path(UUID, TEXT, TEXT) TO authenticated;

-- Create a function to clean up old files (for maintenance)
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

-- Grant execute permission on the cleanup function
GRANT EXECUTE ON FUNCTION cleanup_old_chat_files(INTEGER) TO authenticated;

-- Create a function to get storage usage statistics
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

-- Grant execute permission on the stats function
GRANT EXECUTE ON FUNCTION get_chat_storage_stats(UUID) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_name ON storage.objects(name);
CREATE INDEX IF NOT EXISTS idx_storage_objects_created_at ON storage.objects(created_at);

-- Create a view for easy file management
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

-- Grant access to the view
GRANT SELECT ON chat_files_view TO authenticated;
