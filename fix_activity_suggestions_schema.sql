-- Fix activity_suggestions table schema
-- Run this in your Supabase SQL Editor to fix the timestamp error

-- Add missing columns to activity_suggestions table
ALTER TABLE activity_suggestions 
ADD COLUMN IF NOT EXISTS day_number INTEGER,
ADD COLUMN IF NOT EXISTS time VARCHAR(10),
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS duration_hours DECIMAL(3,1) DEFAULT 1.0;

-- If time_slot column exists and is causing issues, we can either:
-- 1. Drop it if it's not needed
-- 2. Or change its type to TEXT if it's needed

-- Option 1: Drop time_slot column if it's not needed
-- ALTER TABLE activity_suggestions DROP COLUMN IF EXISTS time_slot;

-- Option 2: Change time_slot to TEXT if you want to keep it
ALTER TABLE activity_suggestions 
ALTER COLUMN time_slot TYPE TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_suggestions_trip_id ON activity_suggestions(trip_id);
CREATE INDEX IF NOT EXISTS idx_activity_suggestions_status ON activity_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_activity_suggestions_day_number ON activity_suggestions(day_number);
