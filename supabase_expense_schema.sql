-- Add missing columns to existing expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';

-- Create trip_budgets table for personal budget tracking
CREATE TABLE IF NOT EXISTS trip_budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    budget_limit DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trip_id, user_id)
);

-- Create debt_settlements table for tracking debt payments
CREATE TABLE IF NOT EXISTS debt_settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_is_personal ON expenses(is_personal);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_budgets_trip_id ON trip_budgets(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_budgets_user_id ON trip_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_settlements_trip_id ON debt_settlements(trip_id);
CREATE INDEX IF NOT EXISTS idx_debt_settlements_from_user ON debt_settlements(from_user_id);
CREATE INDEX IF NOT EXISTS idx_debt_settlements_to_user ON debt_settlements(to_user_id);

-- Enable Row Level Security (RLS) for new tables
ALTER TABLE trip_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_settlements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trip_budgets
CREATE POLICY "Users can view their own budgets" ON trip_budgets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets" ON trip_budgets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" ON trip_budgets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" ON trip_budgets
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for debt_settlements
CREATE POLICY "Trip members can view settlements" ON debt_settlements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = debt_settlements.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Trip members can insert settlements" ON debt_settlements
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = debt_settlements.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

-- Update existing expenses table RLS policies if needed
-- (These might already exist, but adding them just in case)
CREATE POLICY IF NOT EXISTS "Trip members can view expenses" ON expenses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = expenses.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Trip members can insert expenses" ON expenses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = expenses.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Trip members can update expenses" ON expenses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = expenses.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Trip members can delete expenses" ON expenses
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM trip_members 
            WHERE trip_members.trip_id = expenses.trip_id 
            AND trip_members.user_id = auth.uid()
        )
    );

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for trip_budgets updated_at
CREATE TRIGGER update_trip_budgets_updated_at 
    BEFORE UPDATE ON trip_budgets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add some sample expense categories if the category column is empty
UPDATE expenses 
SET category = 'other' 
WHERE category IS NULL OR category = '';

-- Optional: Add some default budget limits for existing trips
-- (You can customize this based on your needs)
INSERT INTO trip_budgets (trip_id, user_id, budget_limit)
SELECT DISTINCT 
    tm.trip_id, 
    tm.user_id, 
    1000.00 -- Default budget of $1000
FROM trip_members tm
WHERE NOT EXISTS (
    SELECT 1 FROM trip_budgets tb 
    WHERE tb.trip_id = tm.trip_id 
    AND tb.user_id = tm.user_id
)
ON CONFLICT (trip_id, user_id) DO NOTHING;
