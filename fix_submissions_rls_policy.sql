-- UPDATED: Fix RLS policies for submissions table to properly handle INSERT operations
-- This is now part of the comprehensive database optimization
-- Use complete_database_optimization.sql instead for full schema fixes

-- If you only need to fix submissions RLS policies (quick fix):

BEGIN;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Team leads can manage their own submissions" ON submissions;
DROP POLICY IF EXISTS "Faculty can view all submissions" ON submissions;
DROP POLICY IF EXISTS "Admins can manage all submissions" ON submissions;
DROP POLICY IF EXISTS "Team leads can manage own submissions" ON submissions;
DROP POLICY IF EXISTS "Submissions are viewable by team leads and faculty" ON submissions;
DROP POLICY IF EXISTS "Leads can insert submissions to their team" ON submissions;

-- Create separation policies for better functionality and security

-- Policy 1: Team leads can SELECT their own team's submissions
CREATE POLICY "submissions_select_team_leads" ON submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = submissions.team_id 
            AND t.lead_id = auth.uid()
        )
    );

-- Policy 2: Faculty and admins can SELECT all submissions
CREATE POLICY "submissions_select_faculty" ON submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role IN ('faculty', 'admin')
        )
    );

-- Policy 3: Team leads can INSERT submissions for their own team
CREATE POLICY "submissions_insert_team_leads" ON submissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = team_id 
            AND t.lead_id = auth.uid()
        )
    );

-- Policy 4: Team leads can UPDATE their own team's submissions  
CREATE POLICY "submissions_update_team_leads" ON submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = submissions.team_id 
            AND t.lead_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = team_id 
            AND t.lead_id = auth.uid()
        )
    );

-- Policy 5: Faculty can UPDATE submission status (for grading/review)
CREATE POLICY "submissions_update_faculty" ON submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role IN ('faculty', 'admin')
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role IN ('faculty', 'admin')
        )
    );

-- Policy 6: Team leads can DELETE their own team's submissions (if needed)
CREATE POLICY "submissions_delete_team_leads" ON submissions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = submissions.team_id 
            AND t.lead_id = auth.uid()
        )
    );

COMMIT;

-- Success message
SELECT 'Submissions RLS policies have been fixed successfully!' as status;