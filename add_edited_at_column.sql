-- Add edited_at column to existing chat_messages table
-- Run this in your Supabase SQL editor if the column doesn't exist

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
AND column_name = 'edited_at';
