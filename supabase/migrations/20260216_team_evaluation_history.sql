-- Team Evaluation History Table Migration
-- This migration creates a table to track faculty evaluations of teams with reasons

-- Create team_evaluation_history table
CREATE TABLE IF NOT EXISTS team_evaluation_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  evaluated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  faculty_name TEXT NOT NULL,
  action TEXT CHECK (action IN ('Selected', 'Rejected')) NOT NULL,
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) >= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster queries by team_id
CREATE INDEX IF NOT EXISTS idx_team_evaluation_history_team_id ON team_evaluation_history(team_id);

-- Create index for faster queries by evaluated_by
CREATE INDEX IF NOT EXISTS idx_team_evaluation_history_evaluated_by ON team_evaluation_history(evaluated_by);

-- Enable RLS
ALTER TABLE team_evaluation_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Team evaluation history is viewable by everyone" ON team_evaluation_history;
DROP POLICY IF EXISTS "Faculty can insert evaluation history" ON team_evaluation_history;

-- Create RLS policies
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

-- Grant permissions
GRANT SELECT ON team_evaluation_history TO authenticated;
GRANT INSERT ON team_evaluation_history TO authenticated;

-- Add comment to table
COMMENT ON TABLE team_evaluation_history IS 'Stores the history of team evaluations by faculty members with reasons for selection or rejection';
COMMENT ON COLUMN team_evaluation_history.reason IS 'Reason for selecting or rejecting the team (minimum 10 characters)';
COMMENT ON COLUMN team_evaluation_history.action IS 'Action taken: Selected or Rejected';
COMMENT ON COLUMN team_evaluation_history.faculty_name IS 'Name of the faculty member who evaluated the team';
