-- Add tutorial_completed flag to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN DEFAULT false;

-- Update existing profiles to have the flag set (they've already seen/used the app)
UPDATE profiles SET tutorial_completed = true WHERE tutorial_completed IS NULL;
