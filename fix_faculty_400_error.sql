-- ============================================================================
-- COMPLETE FIX: Faculty Can't Add Problem Statements (400 Error)
-- ============================================================================
-- This script fixes all causes of the 400 error when faculty tries to add problem statements
-- Run this AFTER quick_fix_password_constraint.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: ENSURE ALL TABLES EXIST WITH CORRECT STRUCTURE
-- ============================================================================

-- Create problem_statements table if missing
CREATE TABLE IF NOT EXISTS public.problem_statements (
  id serial PRIMARY KEY,
  title text NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
  description text NOT NULL CHECK (LENGTH(TRIM(description)) > 20),
  department text NOT NULL,
  max_teams integer DEFAULT 3 CHECK (max_teams > 0 AND max_teams <= 10),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- Add check constraints if table already exists
DO $$
BEGIN
  -- Add title constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'problem_statements_title_check'
  ) THEN
    ALTER TABLE problem_statements 
    ADD CONSTRAINT problem_statements_title_check 
    CHECK (LENGTH(TRIM(title)) > 0);
  END IF;
  
  -- Add description constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'problem_statements_description_check'
  ) THEN
    ALTER TABLE problem_statements 
    ADD CONSTRAINT problem_statements_description_check 
    CHECK (LENGTH(TRIM(description)) > 20);
  END IF;
  
  -- Add max_teams constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'problem_statements_max_teams_check'
  ) THEN
    ALTER TABLE problem_statements 
    ADD CONSTRAINT problem_statements_max_teams_check 
    CHECK (max_teams > 0 AND max_teams <= 10);
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_problem_statements_department ON problem_statements(department);
CREATE INDEX IF NOT EXISTS idx_problem_statements_is_active ON problem_statements(is_active);
CREATE INDEX IF NOT EXISTS idx_problem_statements_created_at ON problem_statements(created_at);

-- ============================================================================
-- PART 2: ENSURE PROFILES TABLE HAS CORRECT STRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text UNIQUE,
  role text CHECK (role IN ('lead', 'faculty', 'admin')) DEFAULT 'lead',
  created_at timestamp with time zone DEFAULT NOW()
);

-- ============================================================================
-- PART 3: SET UP HELPER FUNCTION FOR RLS
-- ============================================================================

-- Create or update function to get current user's role
-- Note: Using CREATE OR REPLACE to avoid dropping dependent policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role, 'lead');
END;
$$;

-- ============================================================================
-- PART 4: SET UP RLS POLICIES FOR PROBLEM_STATEMENTS
-- ============================================================================

-- Enable RLS
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (with exact names)
DROP POLICY IF EXISTS "Anyone can view active problem statements" ON problem_statements;
DROP POLICY IF EXISTS "Faculty can insert problem statements" ON problem_statements;
DROP POLICY IF EXISTS "Faculty can update problem statements" ON problem_statements;
DROP POLICY IF EXISTS "Faculty can delete problem statements" ON problem_statements;
DROP POLICY IF EXISTS "Faculty can update their problem statements" ON problem_statements;
DROP POLICY IF EXISTS "Faculty can delete their problem statements" ON problem_statements;

-- Policy 1: Anyone authenticated can view active problem statements
CREATE POLICY "Anyone can view active problem statements"
ON public.problem_statements
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy 2: Faculty can insert problem statements
CREATE POLICY "Faculty can insert problem statements"
ON public.problem_statements
FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() IN ('faculty', 'admin'));

-- Policy 3: Faculty can update problem statements
CREATE POLICY "Faculty can update problem statements"
ON public.problem_statements
FOR UPDATE
TO authenticated
USING (get_current_user_role() IN ('faculty', 'admin'))
WITH CHECK (get_current_user_role() IN ('faculty', 'admin'));

-- Policy 4: Faculty can delete problem statements
CREATE POLICY "Faculty can delete problem statements"
ON public.problem_statements
FOR DELETE
TO authenticated
USING (get_current_user_role() IN ('faculty', 'admin'));

-- ============================================================================
-- PART 5: SET UP RLS POLICIES FOR PROFILES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- PART 6: SET UP TRIGGER FOR AUTOMATIC PROFILE CREATION
-- ============================================================================

-- Note: Creating trigger with OR REPLACE to avoid conflicts
-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text := 'lead'; -- Default role
  user_name text;
BEGIN
  -- Check if this email belongs to a faculty member
  SELECT name INTO user_name
  FROM public.faculty
  WHERE email = NEW.email;
  
  IF FOUND THEN
    user_role := 'faculty';
    
    -- Update faculty table with auth_user_id
    UPDATE public.faculty
    SET auth_user_id = NEW.id
    WHERE email = NEW.email;
  ELSE
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

-- Create trigger (drop first to avoid "already exists" error)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PART 7: FIX EXISTING FACULTY USER IF EXISTS
-- ============================================================================

-- If faculty@gmail.com has a Supabase Auth account but no profile, create it
DO $$
DECLARE
  faculty_auth_id uuid;
  faculty_name_val text;
BEGIN
  -- Get faculty auth_user_id
  SELECT auth_user_id, name INTO faculty_auth_id, faculty_name_val
  FROM public.faculty
  WHERE email = 'faculty@gmail.com' AND auth_user_id IS NOT NULL;
  
  IF FOUND THEN
    -- Create or update profile
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (faculty_auth_id, 'faculty@gmail.com', faculty_name_val, 'faculty')
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = 'faculty';
    
    RAISE NOTICE 'Profile created/updated for faculty@gmail.com';
  ELSE
    RAISE NOTICE 'faculty@gmail.com has no Supabase Auth account yet - will be created on first login';
  END IF;
END $$;

-- ============================================================================
-- PART 8: GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_statements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE problem_statements_id_seq TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check 1: Verify table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'problem_statements')
    THEN '✅ problem_statements table exists'
    ELSE '❌ problem_statements table missing'
  END as table_status;

-- Check 2: Verify RLS is enabled
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS enabled'
    ELSE '❌ RLS disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'problem_statements';

-- Check 3: List all policies
SELECT 
  policyname,
  cmd as operation,
  '✅' as status
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'problem_statements'
ORDER BY policyname;

-- Check 4: Verify faculty user setup
SELECT 
  f.faculty_id,
  f.email,
  f.name,
  p.role,
  CASE 
    WHEN f.auth_user_id IS NOT NULL AND p.role = 'faculty' THEN '✅ Ready to add problem statements'
    WHEN f.auth_user_id IS NULL THEN '⏳ Need to create Supabase Auth account and login once'
    WHEN p.role IS NULL THEN '⏳ Need to login once to create profile'
    WHEN p.role != 'faculty' THEN '⚠️ Wrong role - should be faculty'
    ELSE '⚠️ Unknown status'
  END as status
FROM faculty f
LEFT JOIN profiles p ON f.auth_user_id = p.id
WHERE f.email = 'faculty@gmail.com';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ =================================================================';
  RAISE NOTICE '✅ PROBLEM STATEMENTS TABLE AND RLS POLICIES SET UP SUCCESSFULLY!';
  RAISE NOTICE '✅ =================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What was configured:';
  RAISE NOTICE '   ✓ problem_statements table created';
  RAISE NOTICE '   ✓ RLS policies enabled for faculty';
  RAISE NOTICE '   ✓ profiles table configured';
  RAISE NOTICE '   ✓ Automatic role detection set up';
  RAISE NOTICE '   ✓ All permissions granted';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '';
  RAISE NOTICE '1. CREATE SUPABASE AUTH ACCOUNT (if not done):';
  RAISE NOTICE '   → Supabase Dashboard → Authentication → Users → Add User';
  RAISE NOTICE '   → Email: faculty@gmail.com';
  RAISE NOTICE '   → Password: (set secure password)';
  RAISE NOTICE '   → Check "Auto Confirm User"';
  RAISE NOTICE '';
  RAISE NOTICE '2. LOGIN TO YOUR APP:';
  RAISE NOTICE '   → Use faculty@gmail.com and the password you set';
  RAISE NOTICE '   → This will create the profile and link accounts';
  RAISE NOTICE '';
  RAISE NOTICE '3. TRY ADDING A PROBLEM STATEMENT:';
  RAISE NOTICE '   → Should work without any 400 errors!';
  RAISE NOTICE '';
  RAISE NOTICE '💡 TIP: Check the verification queries above to see current status';
  RAISE NOTICE '';
END $$;
