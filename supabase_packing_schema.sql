-- Packing List Database Schema
-- This schema supports shared and personal packing items with member assignments
-- Note: trips and trip_members tables already exist

-- Add missing columns to existing packing_items table
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS trip_id UUID;
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS packed_by UUID;
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS packed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;
ALTER TABLE packing_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create packing_items table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS packing_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'other',
    is_personal BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL,
    assigned_to UUID,
    is_packed BOOLEAN DEFAULT FALSE,
    packed_by UUID,
    packed_at TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints after table creation
DO $$
BEGIN
    -- Add foreign key to trips table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'packing_items_trip_id_fkey'
    ) THEN
        ALTER TABLE packing_items 
        ADD CONSTRAINT packing_items_trip_id_fkey 
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
    END IF;
    
    -- Add foreign key to auth.users for created_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'packing_items_created_by_fkey'
    ) THEN
        ALTER TABLE packing_items 
        ADD CONSTRAINT packing_items_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add foreign key to auth.users for assigned_to
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'packing_items_assigned_to_fkey'
    ) THEN
        ALTER TABLE packing_items 
        ADD CONSTRAINT packing_items_assigned_to_fkey 
        FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add foreign key to auth.users for packed_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'packing_items_packed_by_fkey'
    ) THEN
        ALTER TABLE packing_items 
        ADD CONSTRAINT packing_items_packed_by_fkey 
        FOREIGN KEY (packed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create packing_categories table for predefined categories
CREATE TABLE IF NOT EXISTS packing_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- Insert default packing categories
INSERT INTO packing_categories (id, name, icon, color, sort_order) VALUES
('clothing', 'Clothing', 'checkroom', '#FF6B6B', 1),
('toiletries', 'Toiletries', 'face', '#4ECDC4', 2),
('electronics', 'Electronics', 'devices', '#45B7D1', 3),
('documents', 'Documents', 'description', '#96CEB4', 4),
('medications', 'Medications', 'local-pharmacy', '#FFEAA7', 5),
('accessories', 'Accessories', 'style', '#DDA0DD', 6),
('snacks', 'Snacks & Food', 'restaurant', '#FFB347', 7),
('other', 'Other', 'more-horiz', '#C7C7CC', 99)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for packing_items
CREATE POLICY "Trip members can view packing items" ON packing_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = packing_items.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Trip members can insert packing items" ON packing_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = packing_items.trip_id 
            AND trip_members.user_id = auth.uid()
        ) AND created_by = auth.uid()
    );

CREATE POLICY "Trip members can update packing items" ON packing_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = packing_items.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Trip members can delete packing items" ON packing_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = packing_items.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

-- Create RLS policies for packing_categories (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view packing categories" ON packing_categories
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_packing_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for packing_items updated_at
CREATE TRIGGER update_packing_items_updated_at 
    BEFORE UPDATE ON packing_items 
    FOR EACH ROW 
    EXECUTE FUNCTION update_packing_items_updated_at();

-- Create a function to automatically set packed_at when is_packed becomes true
CREATE OR REPLACE FUNCTION set_packed_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_packed = TRUE AND OLD.is_packed = FALSE THEN
        NEW.packed_at = NOW();
        NEW.packed_by = auth.uid();
    ELSIF NEW.is_packed = FALSE AND OLD.is_packed = TRUE THEN
        NEW.packed_at = NULL;
        NEW.packed_by = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for packing timestamp
CREATE TRIGGER set_packed_timestamp_trigger
    BEFORE UPDATE ON packing_items
    FOR EACH ROW
    EXECUTE FUNCTION set_packed_timestamp();

-- Add indexes for better performance (after table creation)
CREATE INDEX IF NOT EXISTS idx_packing_items_trip_id ON packing_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_packing_items_created_by ON packing_items(created_by);
CREATE INDEX IF NOT EXISTS idx_packing_items_assigned_to ON packing_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_packing_items_is_personal ON packing_items(is_personal);
CREATE INDEX IF NOT EXISTS idx_packing_items_is_packed ON packing_items(is_packed);
CREATE INDEX IF NOT EXISTS idx_packing_items_category ON packing_items(category);

-- Create a view for packing statistics
CREATE OR REPLACE VIEW packing_stats AS
SELECT 
    trip_id,
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE is_packed = true) as packed_items,
    COUNT(*) FILTER (WHERE is_personal = false) as shared_items,
    COUNT(*) FILTER (WHERE is_personal = true) as personal_items,
    ROUND(
        (COUNT(*) FILTER (WHERE is_packed = true)::DECIMAL / COUNT(*)) * 100, 
        1
    ) as packing_progress_percentage
FROM packing_items
GROUP BY trip_id;


