-- ================================================================
-- TEAM EVALUATION FEATURE - QUICK SETUP SCRIPT
-- ================================================================
-- This script sets up the team evaluation feature
-- Run this in Supabase SQL Editor
-- ================================================================

-- Step 1: Create the evaluation history table
CREATE TABLE IF NOT EXISTS team_evaluation_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  evaluated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  faculty_name TEXT NOT NULL,
  action TEXT CHECK (action IN ('Selected', 'Rejected')) NOT NULL,
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) >= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_evaluation_history_team_id 
ON team_evaluation_history(team_id);

CREATE INDEX IF NOT EXISTS idx_team_evaluation_history_evaluated_by 
ON team_evaluation_history(evaluated_by);

-- Step 3: Enable Row Level Security
ALTER TABLE team_evaluation_history ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if any
DROP POLICY IF EXISTS "Team evaluation history is viewable by everyone" ON team_evaluation_history;
DROP POLICY IF EXISTS "Faculty can insert evaluation history" ON team_evaluation_history;

-- Step 5: Create RLS policies
-- Everyone can view evaluation history (transparency)
CREATE POLICY "Team evaluation history is viewable by everyone"
ON team_evaluation_history FOR SELECT
USING (TRUE);

-- Only faculty and admin can insert evaluation history
CREATE POLICY "Faculty can insert evaluation history"
ON team_evaluation_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('faculty', 'admin')
  )
);

-- Step 6: Grant permissions
GRANT SELECT ON team_evaluation_history TO authenticated;
GRANT INSERT ON team_evaluation_history TO authenticated;

-- Step 7: Add helpful comments
COMMENT ON TABLE team_evaluation_history IS 
'Stores the history of team evaluations by faculty members with reasons for selection or rejection';

COMMENT ON COLUMN team_evaluation_history.reason IS 
'Reason for selecting or rejecting the team (minimum 10 characters)';

COMMENT ON COLUMN team_evaluation_history.action IS 
'Action taken: Selected or Rejected';

COMMENT ON COLUMN team_evaluation_history.faculty_name IS 
'Name of the faculty member who evaluated the team';

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================
-- Run these to verify the setup was successful

-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'team_evaluation_history'
) AS table_exists;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'team_evaluation_history';

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'team_evaluation_history';

-- Check policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'team_evaluation_history';

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================
-- If all queries above return results, the setup is complete!
-- You can now use the team evaluation feature in the faculty dashboard.
-- ================================================================

SELECT 
  '✅ Team Evaluation Feature Setup Complete!' as status,
  'You can now evaluate teams with faculty name and reason tracking.' as message,
  'Check TEAM_EVALUATION_FEATURE_GUIDE.md for full documentation.' as documentation;
