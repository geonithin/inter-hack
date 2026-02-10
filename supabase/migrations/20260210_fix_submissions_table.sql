-- Fix submissions table structure and ensure proper functionality
-- This migration ensures the submissions table works correctly

-- Drop existing table if it has issues and recreate with proper structure
DROP TABLE IF EXISTS submissions CASCADE;

-- Create submissions table with complete structure
CREATE TABLE submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    statement_id integer REFERENCES problem_statements(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text NOT NULL,
    tech_stack text NOT NULL DEFAULT '',
    solution_link text,
    status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected')),
    submitted_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_team_id ON submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_statement_id ON submissions(statement_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);

-- Ensure a team can only submit one idea per statement
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_team_statement ON submissions(team_id, statement_id);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Allow team leads to manage their own submissions
CREATE POLICY "Team leads can manage own submissions" ON submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM teams 
            WHERE teams.id = submissions.team_id 
            AND teams.lead_id = auth.uid()
        )
    );

-- Allow faculty and admins to view all submissions
CREATE POLICY "Faculty can view all submissions" ON submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('faculty', 'admin')
        )
    );

-- Allow admins to manage all submissions
CREATE POLICY "Admins can manage all submissions" ON submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER submissions_update_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_submissions_updated_at();