-- Remove Member Management Features Schema
-- This script removes all member management functionality from the database

-- Drop the member management functions
DROP FUNCTION IF EXISTS get_trip_members_with_details(UUID);
DROP FUNCTION IF EXISTS update_member_role(UUID, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS remove_admin_role(UUID, UUID, UUID);

-- Drop the role constraint (optional - keeps the constraint for data integrity)
-- ALTER TABLE trip_members DROP CONSTRAINT IF EXISTS check_valid_role;

-- Drop the role-related indexes (optional - keeps indexes for performance)
-- DROP INDEX IF EXISTS idx_trip_members_role;
-- DROP INDEX IF EXISTS idx_trip_members_trip_role;
