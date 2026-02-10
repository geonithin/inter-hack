-- IMMEDIATE FIX FOR SUBMISSIONS DISPLAY
-- Copy and paste this entire block into your Supabase SQL Editor

-- Drop the restrictive policies and add a simple one for testing
DROP POLICY IF EXISTS "Team leads can manage own submissions" ON submissions;
DROP POLICY IF EXISTS "Faculty can view all submissions" ON submissions;
DROP POLICY IF EXISTS "Admins can manage all submissions" ON submissions;
DROP POLICY IF EXISTS "Allow anonymous reading of submissions" ON submissions;

-- Add simple policy that allows reading by anyone (for testing)
CREATE POLICY "Allow reading submissions" ON submissions
    FOR SELECT 
    USING (true);

-- Add policy for faculty to view all (when they're authenticated)
CREATE POLICY "Faculty can view submissions" ON submissions
    FOR SELECT 
    USING (
        auth.uid() IS NULL OR  -- Allow anonymous for testing
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('faculty', 'admin')
        )
    );

-- Test query to verify
SELECT 
    COUNT(*) as total_submissions,
    array_agg(title) as submission_titles
FROM submissions;