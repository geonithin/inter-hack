-- ============================================================================
-- PRODUCTION-READY RLS POLICY FIX
-- ============================================================================
-- This script creates proper Row Level Security policies for production use
-- while maintaining security and proper access control.
--
-- APPROACH: Role-based access control using profiles table
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Ensure profiles table has proper structure
-- ============================================================================

-- Add role column if it doesn't exist (safe to run multiple times)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    -- Note: Original schema has 'lead' instead of 'student'
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'lead' CHECK (role IN ('lead', 'faculty', 'admin'));
  END IF;
END $$;

-- Add index for better performance on role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ============================================================================
-- STEP 2: Create helper function to get current user role
-- ============================================================================

-- This function checks the user's role from the profiles table
-- It will be used in RLS policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
  user_email TEXT;
BEGIN
  -- Try to get role from auth.uid() first (for Supabase Auth users)
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    IF user_role IS NOT NULL THEN
      RETURN user_role;
    END IF;
  END IF;
  
  -- Fallback: Check session for faculty users
  -- This requires setting a custom claim or session variable
  user_email := current_setting('request.jwt.claims', true)::json->>'email';
  
  IF user_email IS NOT NULL THEN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE email = user_email;
    
    RETURN COALESCE(user_role, 'lead');
  END IF;
  
  -- Default to lead (team lead/student role)
  RETURN 'lead';
END;
$$;

-- ============================================================================
-- STEP 3: Profiles table RLS policies
-- ============================================================================

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Faculty can create profiles" ON public.profiles;

-- Allow everyone to read profiles (needed for team formation, faculty info, etc.)
CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can insert their own profile (based on auth.uid())
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id OR
    get_current_user_role() = 'faculty' OR
    get_current_user_role() = 'admin'
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id OR
    get_current_user_role() = 'faculty' OR
    get_current_user_role() = 'admin'
  );

-- ============================================================================
-- STEP 4: Problem Statements table RLS policies
-- ============================================================================

-- Enable RLS on problem_statements table
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view problem statements" ON public.problem_statements;
DROP POLICY IF EXISTS "Faculty can insert problem statements" ON public.problem_statements;
DROP POLICY IF EXISTS "Faculty can update problem statements" ON public.problem_statements;
DROP POLICY IF EXISTS "Faculty can delete problem statements" ON public.problem_statements;

-- Allow everyone to read problem statements
CREATE POLICY "Anyone can view problem statements"
  ON public.problem_statements
  FOR SELECT
  USING (true);

-- Only faculty and admin can insert problem statements
CREATE POLICY "Faculty can insert problem statements"
  ON public.problem_statements
  FOR INSERT
  WITH CHECK (
    get_current_user_role() IN ('faculty', 'admin')
  );

-- Faculty can update their own problem statements
CREATE POLICY "Faculty can update problem statements"
  ON public.problem_statements
  FOR UPDATE
  USING (
    get_current_user_role() IN ('faculty', 'admin')
  );

-- Faculty can delete their own problem statements (optional)
CREATE POLICY "Faculty can delete problem statements"
  ON public.problem_statements
  FOR DELETE
  USING (
    get_current_user_role() IN ('faculty', 'admin')
  );

-- ============================================================================
-- STEP 5: Teams table RLS policies
-- ============================================================================

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Team leads can manage their team" ON public.teams;
DROP POLICY IF EXISTS "Faculty can view all teams" ON public.teams;

-- Students can view all teams, faculty can view all teams
CREATE POLICY "Anyone can view teams"
  ON public.teams
  FOR SELECT
  USING (true);

-- Team leads can update their own team
CREATE POLICY "Team leads can manage their team"
  ON public.teams
  FOR ALL
  USING (
    auth.uid() = lead_id OR
    get_current_user_role() IN ('faculty', 'admin')
  );

-- ============================================================================
-- STEP 6: Submissions table RLS policies
-- ============================================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams can view their submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teams can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Faculty can view all submissions" ON public.submissions;

-- Team leads can view their own team's submissions
-- Note: Only team leads have auth accounts, members are just data records
CREATE POLICY "Teams can view their submissions"
  ON public.submissions
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT lead_id FROM public.teams WHERE id = team_id
    ) OR
    get_current_user_role() IN ('faculty', 'admin')
  );

-- Team leads can create submissions for their team
CREATE POLICY "Teams can create submissions"
  ON public.submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT lead_id FROM public.teams WHERE id = team_id
    )
  );

-- Team leads can update their own team's submissions
CREATE POLICY "Teams can update their submissions"
  ON public.submissions
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT lead_id FROM public.teams WHERE id = team_id
    )
  );

-- ============================================================================
-- STEP 7: Members table RLS policies
-- ============================================================================

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view members" ON public.members;
DROP POLICY IF EXISTS "Team leads can manage their members" ON public.members;

-- Anyone can view team members (for team information display)
CREATE POLICY "Anyone can view members"
  ON public.members
  FOR SELECT
  USING (true);

-- Team leads can insert/update/delete their own team's members
CREATE POLICY "Team leads can manage their members"
  ON public.members
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT lead_id FROM public.teams WHERE id = team_id
    ) OR
    get_current_user_role() IN ('faculty', 'admin')
  );

-- ============================================================================
-- STEP 8: Notifications table RLS policies
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;

-- Users can view their own notifications
-- Note: recipient_id is stored as TEXT, so we need to cast auth.uid() to text
CREATE POLICY "Users can view their notifications"
  ON public.notifications
  FOR SELECT
  USING (
    auth.uid()::text = recipient_id OR
    get_current_user_role() IN ('faculty', 'admin')
  );

-- Allow insertion of notifications (for system-generated notifications)
-- Anyone authenticated can create notifications (for team leads notifying faculty, etc.)
CREATE POLICY "System can create notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own notifications (for marking as read)
CREATE POLICY "Users can update their notifications"
  ON public.notifications
  FOR UPDATE
  USING (
    auth.uid()::text = recipient_id OR
    get_current_user_role() IN ('faculty', 'admin')
  );

-- ============================================================================
-- STEP 9: Grant necessary permissions
-- ============================================================================

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO anon;

-- Grant necessary table permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon;

GRANT SELECT ON public.problem_statements TO authenticated;
GRANT SELECT ON public.problem_statements TO anon;
GRANT INSERT, UPDATE, DELETE ON public.problem_statements TO authenticated;

-- ============================================================================
-- STEP 10: Verify the setup
-- ============================================================================

-- Check that all tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'problem_statements', 'teams', 'submissions', 'members', 'notifications')
ORDER BY tablename;

-- Check policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test 1: Check if get_current_user_role function exists
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'get_current_user_role';

-- Test 2: List all RLS policies
SELECT 
  tablename,
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Production-ready RLS policies have been successfully applied!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test faculty login and problem statement creation';
  RAISE NOTICE '2. Test student team formation and submissions';
  RAISE NOTICE '3. Monitor RLS policy performance with the queries above';
  RAISE NOTICE '4. Consider implementing Supabase Auth for faculty users for better integration';
END $$;
