-- QUICK FIX: Remove RLS restrictions temporarily for development
-- Run this in Supabase SQL Editor to fix the 401 error immediately

-- This is the fastest solution for development
-- WARNING: This makes the table publicly accessible - only use for development!

-- Remove all existing policies
DROP POLICY IF EXISTS "problem_statements_select_all" ON problem_statements;
DROP POLICY IF EXISTS "problem_statements_manage_faculty" ON problem_statements;
DROP POLICY IF EXISTS "problem_statements_insert_all" ON problem_statements;
DROP POLICY IF EXISTS "problem_statements_update_all" ON problem_statements;
DROP POLICY IF EXISTS "problem_statements_delete_all" ON problem_statements;
DROP POLICY IF EXISTS "problem_statements_manage_faculty_relaxed" ON problem_statements;

-- Option 1: Completely disable RLS (EASIEST - for development only)
ALTER TABLE problem_statements DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled but allow all access, comment out Option 1 above and uncomment below:
-- CREATE POLICY "allow_all_problem_statements" ON problem_statements FOR ALL USING (true) WITH CHECK (true);

-- Verify it worked
SELECT 
    schemaname, 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename = 'problem_statements';

-- You should see rowsecurity = false
-- If rowsecurity = true, then Option 2 policy is active

-- Test by running this (should work now):
-- INSERT INTO problem_statements (title, description, department, max_teams, is_active) 
-- VALUES ('Test Statement', 'This is a test', 'CS', 3, true);

-- Clean up test data:
-- DELETE FROM problem_statements WHERE title = 'Test Statement';

-- SUCCESS! You can now add problem statements from the Faculty Dashboard.
