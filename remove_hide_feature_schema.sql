-- Remove Hide Feature Schema
-- This script removes all hide-related functionality from the database

-- Drop the member_trip_visibility table and all related objects
DROP TABLE IF EXISTS member_trip_visibility CASCADE;

-- Drop the related functions
DROP FUNCTION IF EXISTS get_user_trip_visibility(UUID, UUID);
DROP FUNCTION IF EXISTS set_user_trip_visibility(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS get_user_visible_trips(UUID);

-- Remove the is_hidden column from trips table if it exists
ALTER TABLE trips DROP COLUMN IF EXISTS is_hidden;
