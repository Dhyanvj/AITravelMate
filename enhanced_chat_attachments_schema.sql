-- Enhanced Chat Attachments Schema for Supabase
-- This schema optimizes file attachments including photos and documents

-- Ensure the chat_messages table has all necessary columns
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    encrypted BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT NULL,
    read_by JSONB DEFAULT '[]'::jsonb,
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced chat_attachments table with better file support
CREATE TABLE IF NOT EXISTS chat_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL, -- Changed to BIGINT for larger files
    file_path TEXT, -- Store the storage path for easier management
    thumbnail_url TEXT, -- For image thumbnails
    width INTEGER, -- For images
    height INTEGER, -- For images
    duration INTEGER, -- For videos (in seconds)
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add any missing columns to existing tables
DO $$ 
BEGIN
    -- Add edited_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'edited_at') THEN
        ALTER TABLE chat_messages ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
    
    -- Add file_path column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'file_path') THEN
        ALTER TABLE chat_attachments ADD COLUMN file_path TEXT;
    END IF;
    
    -- Add thumbnail_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'thumbnail_url') THEN
        ALTER TABLE chat_attachments ADD COLUMN thumbnail_url TEXT;
    END IF;
    
    -- Add width column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'width') THEN
        ALTER TABLE chat_attachments ADD COLUMN width INTEGER;
    END IF;
    
    -- Add height column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'height') THEN
        ALTER TABLE chat_attachments ADD COLUMN height INTEGER;
    END IF;
    
    -- Add duration column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'duration') THEN
        ALTER TABLE chat_attachments ADD COLUMN duration INTEGER;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_attachments' AND column_name = 'updated_at') THEN
        ALTER TABLE chat_attachments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Change file_size to BIGINT if it's currently INTEGER
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_attachments' AND column_name = 'file_size' AND data_type = 'integer') THEN
        ALTER TABLE chat_attachments ALTER COLUMN file_size TYPE BIGINT;
    END IF;
END $$;

-- Message Reactions Table (if not exists)
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Enhanced indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_trip_id ON chat_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_file_type ON chat_attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_uploaded_by ON chat_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_created_at ON chat_attachments(created_at);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view messages for trips they are members of" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages for trips they are members of" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view attachments for messages they can see" ON chat_attachments;
DROP POLICY IF EXISTS "Users can insert attachments for their own messages" ON chat_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON chat_attachments;
DROP POLICY IF EXISTS "Users can view reactions for messages they can see" ON message_reactions;
DROP POLICY IF EXISTS "Users can insert reactions for messages they can see" ON message_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON message_reactions;

-- Enhanced Chat Messages Policies
CREATE POLICY "Users can view messages for trips they are members of" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = chat_messages.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages for trips they are members of" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = chat_messages.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = chat_messages.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own messages" ON chat_messages
    FOR DELETE USING (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = chat_messages.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

-- Enhanced Chat Attachments Policies
CREATE POLICY "Users can view attachments for messages they can see" ON chat_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_messages 
            JOIN trip_members ON trip_members.trip_id = chat_messages.trip_id
            WHERE chat_attachments.message_id = chat_messages.id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert attachments for their own messages" ON chat_attachments
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM chat_messages 
            WHERE chat_attachments.message_id = chat_messages.id 
            AND chat_messages.sender_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own attachments" ON chat_attachments
    FOR UPDATE USING (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own attachments" ON chat_attachments
    FOR DELETE USING (uploaded_by = auth.uid());

-- Message Reactions Policies
CREATE POLICY "Users can view reactions for messages they can see" ON message_reactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_messages 
            JOIN trip_members ON trip_members.trip_id = chat_messages.trip_id
            WHERE message_reactions.message_id = chat_messages.id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert reactions for messages they can see" ON message_reactions
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM chat_messages 
            JOIN trip_members ON trip_members.trip_id = chat_messages.trip_id
            WHERE message_reactions.message_id = chat_messages.id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own reactions" ON message_reactions
    FOR DELETE USING (user_id = auth.uid());

-- Create storage bucket for chat files with proper configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
    'chat-files', 
    'chat-files', 
    true, 
    52428800, -- 50MB limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
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

-- Enhanced storage policies for chat files
DROP POLICY IF EXISTS "Users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat files" ON storage.objects;

CREATE POLICY "Users can upload chat files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-files' AND
        auth.uid() IS NOT NULL AND
        (storage.foldername(name))[1] = 'chat-files'
    );

CREATE POLICY "Users can view chat files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'chat-files' AND
        (
            -- Users can view files from trips they are members of
            EXISTS (
                SELECT 1 FROM chat_attachments ca
                JOIN chat_messages cm ON ca.message_id = cm.id
                JOIN trip_members tm ON tm.trip_id = cm.trip_id
                WHERE ca.file_path = storage.objects.name
                AND tm.user_id = auth.uid()
            )
        )
    );

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

-- Functions for real-time updates and file management

-- Function to update read_by array when a message is read
CREATE OR REPLACE FUNCTION update_message_read_by()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if the user is not already in the read_by array
    IF NOT (NEW.read_by ? NEW.sender_id::text) THEN
        NEW.read_by = NEW.read_by || jsonb_build_array(NEW.sender_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically add sender to read_by when message is created
DROP TRIGGER IF EXISTS trigger_update_read_by ON chat_messages;
CREATE TRIGGER trigger_update_read_by
    BEFORE INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_message_read_by();

-- Function to clean up orphaned files when attachments are deleted
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the file from storage when attachment is deleted
    DELETE FROM storage.objects 
    WHERE bucket_id = 'chat-files' 
    AND name = OLD.file_path;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to clean up files when attachments are deleted
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_files ON chat_attachments;
CREATE TRIGGER trigger_cleanup_orphaned_files
    AFTER DELETE ON chat_attachments
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_orphaned_files();

-- Function to update attachment updated_at timestamp
CREATE OR REPLACE FUNCTION update_attachment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at when attachment is modified
DROP TRIGGER IF EXISTS trigger_update_attachment_updated_at ON chat_attachments;
CREATE TRIGGER trigger_update_attachment_updated_at
    BEFORE UPDATE ON chat_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_attachment_updated_at();

-- Grant necessary permissions
GRANT ALL ON chat_messages TO authenticated;
GRANT ALL ON chat_attachments TO authenticated;
GRANT ALL ON message_reactions TO authenticated;

-- Grant storage permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- Create a view for easier attachment queries
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

-- Grant access to the view
GRANT SELECT ON chat_attachments_with_metadata TO authenticated;

-- Create function to get file statistics
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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_trip_file_stats(UUID) TO authenticated;
