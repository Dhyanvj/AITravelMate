-- Add is_ai_generated column to activity_suggestions table
-- Run this in your Supabase SQL Editor

-- Add the is_ai_generated column to identify AI-generated suggestions
ALTER TABLE activity_suggestions 
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;

-- Add an index for better performance when filtering AI-generated suggestions
CREATE INDEX IF NOT EXISTS idx_activity_suggestions_ai_generated ON activity_suggestions(is_ai_generated);

-- Update any existing suggestions to have is_ai_generated = false (manual suggestions)
UPDATE activity_suggestions 
SET is_ai_generated = FALSE 
WHERE is_ai_generated IS NULL;
