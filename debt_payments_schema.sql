-- Create debt_payments table for tracking member payments
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_debt_payments_trip_id ON debt_payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_from_user ON debt_payments(from_user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_to_user ON debt_payments(to_user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_paid_at ON debt_payments(paid_at);

-- Enable RLS (Row Level Security)
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for debt_payments
CREATE POLICY "Users can view debt payments for their trips" ON debt_payments
  FOR SELECT USING (
    trip_id IN (
      SELECT id FROM trips 
      WHERE id IN (
        SELECT trip_id FROM trip_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create debt payments for their trips" ON debt_payments
  FOR INSERT WITH CHECK (
    trip_id IN (
      SELECT id FROM trips 
      WHERE id IN (
        SELECT trip_id FROM trip_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update debt payments they created" ON debt_payments
  FOR UPDATE USING (
    from_user_id = auth.uid() OR to_user_id = auth.uid()
  );

CREATE POLICY "Users can delete debt payments they created" ON debt_payments
  FOR DELETE USING (
    from_user_id = auth.uid() OR to_user_id = auth.uid()
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_debt_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_debt_payments_updated_at
  BEFORE UPDATE ON debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_debt_payments_updated_at();
