-- Fix Faculty Roles and Permissions
-- Run this in your Supabase SQL Editor to fix faculty role issues

-- PROBLEM: Faculty users login via custom faculty table, not Supabase Auth
-- This causes RLS policies that check auth.uid() to fail
-- SOLUTION: Create more permissive policies for problem_statements

-- 1. First, let's see what we're working with
SELECT id, email, full_name, role, created_at 
FROM profiles 
ORDER BY created_at DESC
LIMIT 20;

SELECT id, faculty_id, name, email, department, is_active
FROM faculty
WHERE is_active = true;

-- 2. RECOMMENDED FIX: Make problem_statements accessible for development
-- This allows anyone to manage problem statements (suitable for development/testing)
DROP POLICY IF EXISTS "problem_statements_manage_faculty" ON problem_statements;
DROP POLICY IF EXISTS "problem_statements_select_all" ON problem_statements;

-- Allow everyone to view problem statements
CREATE POLICY "problem_statements_select_all" ON problem_statements 
FOR SELECT 
USING (true);

-- Allow everyone to insert/update/delete problem statements (for development)
-- In production, you'd want stricter policies
CREATE POLICY "problem_statements_insert_all" ON problem_statements 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "problem_statements_update_all" ON problem_statements 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

CREATE POLICY "problem_statements_delete_all" ON problem_statements 
FOR DELETE 
USING (true);

-- 3. Verify the policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'problem_statements';

-- 4. Test by trying to insert a test statement (you can delete it after)
-- Uncomment to test:
-- INSERT INTO problem_statements (title, description, department, max_teams, is_active) 
-- VALUES ('Test Statement', 'This is a test problem statement to verify permissions are working correctly.', 'CS', 3, true);

-- 5. Clean up test data (uncomment after testing)
-- DELETE FROM problem_statements WHERE title = 'Test Statement';

-- SUCCESS! You should now be able to add problem statements from the Faculty Dashboard.
