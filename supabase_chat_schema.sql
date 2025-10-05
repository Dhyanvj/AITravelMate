-- Chat Messages Table
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

-- Add edited_at column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'edited_at') THEN
        ALTER TABLE chat_messages ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
END $$;

-- Chat Attachments Table
CREATE TABLE IF NOT EXISTS chat_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message Reactions Table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_trip_id ON chat_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Chat Messages Policies
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

-- Chat Attachments Policies
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

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat files
CREATE POLICY "Users can upload chat files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-files' AND
        auth.uid() IS NOT NULL
    );

CREATE POLICY "Users can view chat files" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-files');

CREATE POLICY "Users can delete their own chat files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'chat-files' AND
        owner = auth.uid()
    );

-- Functions for real-time updates

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
CREATE TRIGGER trigger_update_read_by
    BEFORE INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_message_read_by();

-- Function to clean up old typing indicators (optional)
CREATE OR REPLACE FUNCTION cleanup_old_typing_indicators()
RETURNS void AS $$
BEGIN
    -- This would be called periodically to clean up old typing indicators
    -- For now, we'll handle typing indicators client-side
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON chat_messages TO authenticated;
GRANT ALL ON chat_attachments TO authenticated;
GRANT ALL ON message_reactions TO authenticated;

-- Grant storage permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
