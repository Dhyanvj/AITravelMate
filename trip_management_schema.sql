-- Trip Management Database Schema Updates
-- This schema adds missing columns for comprehensive trip management

-- Add missing columns to existing trips table
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trip_settings table for advanced trip configuration
CREATE TABLE IF NOT EXISTS trip_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    allow_expense_editing BOOLEAN DEFAULT TRUE,
    require_admin_approval BOOLEAN DEFAULT FALSE,
    auto_split_expenses BOOLEAN DEFAULT TRUE,
    budget_limit DECIMAL(10,2) DEFAULT NULL,
    allow_member_invites BOOLEAN DEFAULT TRUE,
    max_members INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trip_id)
);

-- Create trip_invites table for invite code management
CREATE TABLE IF NOT EXISTS trip_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    invite_code VARCHAR(6) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    uses_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_logs table for trip activity tracking
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trip_members table for member management
CREATE TABLE IF NOT EXISTS trip_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(trip_id, user_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_is_hidden ON trips(is_hidden);
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_settings_trip_id ON trip_settings(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invites_trip_id ON trip_invites(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invites_invite_code ON trip_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_trip_invites_expires_at ON trip_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_trip_id ON activity_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_role ON trip_members(role);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at 
    BEFORE UPDATE ON trips 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_settings_updated_at ON trip_settings;
CREATE TRIGGER update_trip_settings_updated_at 
    BEFORE UPDATE ON trip_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_invites_updated_at ON trip_invites;
CREATE TRIGGER update_trip_invites_updated_at 
    BEFORE UPDATE ON trip_invites 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies for data protection
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

-- Trips policies
CREATE POLICY "Users can view trips they are members of" ON trips
    FOR SELECT USING (
        id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Trip owners can update their trips" ON trips
    FOR UPDATE USING (
        created_by = auth.uid() OR 
        id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Trip owners can delete their trips" ON trips
    FOR DELETE USING (
        created_by = auth.uid() OR 
        id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- Trip settings policies
CREATE POLICY "Trip members can view trip settings" ON trip_settings
    FOR SELECT USING (
        trip_id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Trip admins can update trip settings" ON trip_settings
    FOR ALL USING (
        trip_id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Trip invites policies
CREATE POLICY "Trip members can view trip invites" ON trip_invites
    FOR SELECT USING (
        trip_id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Trip admins can manage trip invites" ON trip_invites
    FOR ALL USING (
        trip_id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Activity logs policies
CREATE POLICY "Trip members can view activity logs" ON activity_logs
    FOR SELECT USING (
        trip_id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Trip members can create activity logs" ON activity_logs
    FOR INSERT WITH CHECK (
        trip_id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid()
        )
    );

-- Trip members policies
CREATE POLICY "Trip members can view other members" ON trip_members
    FOR SELECT USING (
        trip_id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Trip admins can manage members" ON trip_members
    FOR ALL USING (
        trip_id IN (
            SELECT trip_id FROM trip_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Allow users to join trips via invite codes
CREATE POLICY "Users can join trips with valid invite codes" ON trip_members
    FOR INSERT WITH CHECK (
        trip_id IN (
            SELECT ti.trip_id FROM trip_invites ti
            WHERE ti.is_active = true 
            AND ti.expires_at > NOW()
        )
    );
