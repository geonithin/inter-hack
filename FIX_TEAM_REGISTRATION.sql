-- COMPREHENSIVE FIX: Run this SQL in your Supabase SQL Editor to fix ALL registration issues
-- This fixes check constraints, adds missing columns, and prevents future registration errors

-- ============================================
-- STEP 1: Fix TEAMS table department constraint
-- ============================================
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_department_valid;
ALTER TABLE teams ADD CONSTRAINT teams_department_valid 
  CHECK (department IN ('CSE', 'AIDS', 'ECE', 'EEE', 'MECH', 'CIVIL'));

-- ============================================
-- STEP 2: Fix MEMBERS table department constraint
-- ============================================
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_department_valid;
ALTER TABLE members ADD CONSTRAINT members_department_valid 
  CHECK (department IN ('CSE', 'AIDS', 'ECE', 'EEE', 'MECH', 'CIVIL') OR department IS NULL);

-- ============================================
-- STEP 3: Fix phone format constraints (allow spaces and various formats)
-- ============================================
-- Drop strict phone format constraint if it exists
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_phone_format;
-- Add more lenient phone constraint (allows spaces, dashes, parentheses)
ALTER TABLE members ADD CONSTRAINT members_phone_format 
  CHECK (phone IS NULL OR LENGTH(TRIM(phone)) >= 10);

-- ============================================
-- STEP 4: Fix NOTIFICATIONS recipient_type constraint
-- ============================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_recipient_type_check 
  CHECK (recipient_type IN ('faculty', 'team', 'admin', 'lead'));

-- ============================================
-- STEP 5: Add missing lead columns to TEAMS table
-- ============================================
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lead_name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lead_email text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lead_register_number text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lead_phone text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default timezone('utc'::text, now());

-- ============================================
-- STEP 6: Update existing teams with lead info from profiles
-- ============================================
UPDATE teams 
SET 
  lead_name = profiles.full_name,
  lead_email = profiles.email
FROM profiles 
WHERE teams.lead_id = profiles.id 
AND (teams.lead_name IS NULL OR teams.lead_email IS NULL);

-- ============================================
-- STEP 7: Create function for updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 8: Create trigger for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 9: Verify setup with a test query
-- ============================================
-- Run this to verify all constraints are properly set:
SELECT 
  'SUCCESS: All constraints fixed!' as status,
  (SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_name = 'teams_department_valid') as teams_dept_ok,
  (SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_name = 'members_department_valid') as members_dept_ok,
  (SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_name = 'notifications_recipient_type_check') as notifications_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'lead_name') as lead_columns_ok;

