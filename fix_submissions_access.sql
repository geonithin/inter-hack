-- TEMPORARY FIX: Allow anonymous reading of submissions for testing
-- Run this in Supabase SQL Editor

-- Add a policy to allow anyone to read submissions (for testing only)
CREATE POLICY "Allow anonymous reading of submissions" ON submissions
    FOR SELECT 
    USING (true);

-- Verify it works
SELECT 
    s.title,
    s.description,
    s.tech_stack,
    s.status,
    t.name as team_name
FROM submissions s
JOIN teams t ON s.team_id = t.id
ORDER BY s.created_at DESC;