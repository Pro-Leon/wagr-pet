-- ========================================
-- Wagr Migration: Account & Billing Features
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE)
-- ========================================

-- Add notification preferences column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email_updates": true,
  "sitter_activity": true,
  "billing_alerts": true,
  "marketing": false
}'::jsonb;

-- Add billing info columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- ========================================
-- PAYMENT HISTORY TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_code TEXT,
    transaction_reference TEXT,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'refunded')),
    payment_method TEXT,
    description TEXT,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- User can view their own payment history
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_history' AND policyname = 'Users can view own payment history') THEN
    CREATE POLICY "Users can view own payment history" ON payment_history
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id, paid_at DESC);

-- ========================================
-- UPDATE PROFILES RLS FOR NOTIFICATION PREFS
-- ========================================
-- User can update their own notification_preferences
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    -- Already exists from initial schema, skip
  END IF;
END $$;
