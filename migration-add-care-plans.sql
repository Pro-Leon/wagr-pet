-- ========================================
-- Care Plans for Pet Sitters
-- ========================================

-- Care Plans table
CREATE TABLE IF NOT EXISTS care_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sitter_name TEXT NOT NULL,
    sitter_email TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    feeding_instructions TEXT,
    medication_instructions TEXT,
    walking_exercise TEXT,
    behavioral_notes TEXT,
    emergency_contact TEXT,
    vet_info TEXT,
    additional_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own care plans
CREATE POLICY "Users can manage own care plans" ON care_plans
    FOR ALL USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_care_plans_pet ON care_plans(pet_id);
CREATE INDEX idx_care_plans_active ON care_plans(pet_id, is_active);

-- Update updated_at trigger
CREATE TRIGGER update_care_plans_updated_at
    BEFORE UPDATE ON care_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Add sitter_name to pet_logs for tracking
-- ========================================

ALTER TABLE pet_logs ADD COLUMN IF NOT EXISTS sitter_name TEXT;

-- Note: This adds labelling to notes from sitters
-- When a sitter adds a log via the sitter link, their name will be recorded