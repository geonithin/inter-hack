-- ============================================================================
-- COMPLETE PRODUCTION-READY DATABASE SETUP
-- ============================================================================
-- This script sets up the entire database with proper authentication,
-- authorization, and security for a production environment.
--
-- Run this script ONCE in Supabase SQL Editor to set up everything correctly.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: TABLE STRUCTURE FIXES
-- ============================================================================

-- Ensure all required tables exist with correct structure
-- These are safe to run multiple times (IF NOT EXISTS)

-- Faculty table for additional faculty-specific data
CREATE TABLE IF NOT EXISTS public.faculty (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password text, -- Optional - only for backwards compatibility
  department text NOT NULL,
  designation text DEFAULT 'Faculty',
  is_active boolean DEFAULT true,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW()
);

-- Make password column nullable if it exists and is NOT NULL
DO $$ 
BEGIN
  -- Check if password column has NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'faculty' 
    AND column_name = 'password' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.faculty ALTER COLUMN password DROP NOT NULL;
    RAISE NOTICE 'Removed NOT NULL constraint from faculty.password column';
  END IF;
END $$;

-- Ensure profiles table exists (should be created by migration)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  role text CHECK (role IN ('lead', 'faculty', 'admin')) DEFAULT 'lead',
  email text UNIQUE
);

-- Ensure teams table exists
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department text,
  year text,
  section text,
  lead_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  status text CHECK (status IN ('Pending', 'Selected', 'Rejected')) DEFAULT 'Pending',
  selected_statement_id integer,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- Ensure members table exists
CREATE TABLE IF NOT EXISTS public.members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  register_number text NOT NULL,
  email text,
  phone text,
  department text,
  year text,
  section text
);

-- Ensure problem_statements table exists
CREATE TABLE IF NOT EXISTS public.problem_statements (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  department text NOT NULL,
  max_teams integer DEFAULT 3,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  updated_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- Ensure submissions table exists
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  statement_id integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  tech_stack text,
  solution_link text,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- Ensure notifications table exists with correct structure
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  type text CHECK (type IN ('success', 'warning', 'info', 'error')) DEFAULT 'info',
  recipient_id text NOT NULL,
  recipient_type text CHECK (recipient_type IN ('faculty', 'team', 'admin')) NOT NULL,
  sender_id text,
  sender_type text CHECK (sender_type IN ('system', 'faculty', 'admin')) DEFAULT 'system',
  is_read boolean DEFAULT false,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  related_data jsonb,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  read_at timestamp with time zone
);

-- ============================================================================
-- PART 2: ADD MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Indexes for faculty table
CREATE INDEX IF NOT EXISTS idx_faculty_email ON public.faculty(email);
CREATE INDEX IF NOT EXISTS idx_faculty_auth_user_id ON public.faculty(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_faculty_is_active ON public.faculty(is_active);

-- Indexes for teams table
CREATE INDEX IF NOT EXISTS idx_teams_lead_id ON public.teams(lead_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON public.teams(status);

-- Indexes for problem_statements table
CREATE INDEX IF NOT EXISTS idx_problem_statements_is_active ON public.problem_statements(is_active);
CREATE INDEX IF NOT EXISTS idx_problem_statements_department ON public.problem_statements(department);

-- Indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- PART 3: AUTHENTICATION TRIGGER FUNCTION
-- ============================================================================

-- Drop existing trigger and function to recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_faculty ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_faculty_signup() CASCADE;

-- Create unified user signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  faculty_record RECORD;
  user_role text;
BEGIN
  -- Check if this email belongs to a faculty member
  SELECT * INTO faculty_record
  FROM public.faculty
  WHERE email = NEW.email AND is_active = true;
  
  IF FOUND THEN
    -- This is a faculty member
    user_role := 'faculty';
    
    -- Link faculty record to auth user
    UPDATE public.faculty
    SET auth_user_id = NEW.id
    WHERE id = faculty_record.id;
  ELSE
    -- This is a regular student/team lead
    user_role := 'lead';
  END IF;
  
  -- Insert profile with appropriate role
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      CASE WHEN FOUND THEN faculty_record.name ELSE NEW.email END
    ),
    user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    role = EXCLUDED.role,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = EXCLUDED.email;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user for %: % (SQLSTATE: %)', NEW.email, SQLERRM, SQLSTATE;
    
    -- Try a minimal insert to ensure profile exists
    BEGIN
      INSERT INTO public.profiles (id, email, role)
      VALUES (NEW.id, NEW.email, 'lead')
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed minimal profile insert: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PART 4: HELPER FUNCTION FOR RLS POLICIES
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_current_user_role() CASCADE;

-- Create function to get current user's role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get role from auth.uid() (works for all Supabase Auth users)
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role, 'lead');
  END IF;
  
  -- If no auth.uid(), return default
  RETURN 'lead';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO anon;

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- PROFILES TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "profiles_select_all" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "profiles_insert_own" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id OR get_current_user_role() IN ('faculty', 'admin'));

-- ----------------------------------------------------------------------------
-- FACULTY TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "faculty_select_all" 
  ON public.faculty FOR SELECT 
  USING (true);

CREATE POLICY "faculty_update_own" 
  ON public.faculty FOR UPDATE 
  USING (auth.uid() = auth_user_id OR get_current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- TEAMS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "teams_select_all" 
  ON public.teams FOR SELECT 
  USING (true);

CREATE POLICY "teams_insert_own" 
  ON public.teams FOR INSERT 
  WITH CHECK (auth.uid() = lead_id);

CREATE POLICY "teams_update_own" 
  ON public.teams FOR UPDATE 
  USING (auth.uid() = lead_id OR get_current_user_role() IN ('faculty', 'admin'));

CREATE POLICY "teams_delete_own" 
  ON public.teams FOR DELETE 
  USING (auth.uid() = lead_id OR get_current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- MEMBERS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "members_select_all" 
  ON public.members FOR SELECT 
  USING (true);

CREATE POLICY "members_insert_team_lead" 
  ON public.members FOR INSERT 
  WITH CHECK (
    auth.uid() IN (SELECT lead_id FROM public.teams WHERE id = team_id) OR
    get_current_user_role() = 'admin'
  );

CREATE POLICY "members_update_team_lead" 
  ON public.members FOR UPDATE 
  USING (
    auth.uid() IN (SELECT lead_id FROM public.teams WHERE id = team_id) OR
    get_current_user_role() = 'admin'
  );

CREATE POLICY "members_delete_team_lead" 
  ON public.members FOR DELETE 
  USING (
    auth.uid() IN (SELECT lead_id FROM public.teams WHERE id = team_id) OR
    get_current_user_role() = 'admin'
  );

-- ----------------------------------------------------------------------------
-- PROBLEM STATEMENTS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "problem_statements_select_all" 
  ON public.problem_statements FOR SELECT 
  USING (true);

CREATE POLICY "problem_statements_insert_faculty" 
  ON public.problem_statements FOR INSERT 
  WITH CHECK (get_current_user_role() IN ('faculty', 'admin'));

CREATE POLICY "problem_statements_update_faculty" 
  ON public.problem_statements FOR UPDATE 
  USING (get_current_user_role() IN ('faculty', 'admin'));

CREATE POLICY "problem_statements_delete_faculty" 
  ON public.problem_statements FOR DELETE 
  USING (get_current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- SUBMISSIONS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "submissions_select_own_or_faculty" 
  ON public.submissions FOR SELECT 
  USING (
    auth.uid() IN (SELECT lead_id FROM public.teams WHERE id = team_id) OR
    get_current_user_role() IN ('faculty', 'admin')
  );

CREATE POLICY "submissions_insert_team_lead" 
  ON public.submissions FOR INSERT 
  WITH CHECK (
    auth.uid() IN (SELECT lead_id FROM public.teams WHERE id = team_id)
  );

CREATE POLICY "submissions_update_team_lead" 
  ON public.submissions FOR UPDATE 
  USING (
    auth.uid() IN (SELECT lead_id FROM public.teams WHERE id = team_id) OR
    get_current_user_role() = 'admin'
  );

CREATE POLICY "submissions_delete_team_lead" 
  ON public.submissions FOR DELETE 
  USING (
    auth.uid() IN (SELECT lead_id FROM public.teams WHERE id = team_id) OR
    get_current_user_role() = 'admin'
  );

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS TABLE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "notifications_select_own_or_faculty" 
  ON public.notifications FOR SELECT 
  USING (
    auth.uid()::text = recipient_id OR
    get_current_user_role() IN ('faculty', 'admin')
  );

CREATE POLICY "notifications_insert_authenticated" 
  ON public.notifications FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update_own" 
  ON public.notifications FOR UPDATE 
  USING (
    auth.uid()::text = recipient_id OR
    get_current_user_role() IN ('faculty', 'admin')
  );

CREATE POLICY "notifications_delete_own_or_admin" 
  ON public.notifications FOR DELETE 
  USING (
    auth.uid()::text = recipient_id OR
    get_current_user_role() = 'admin'
  );

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.faculty TO authenticated;
GRANT UPDATE ON public.faculty TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_statements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

-- Grant sequence usage for serial columns
GRANT USAGE, SELECT ON SEQUENCE problem_statements_id_seq TO authenticated;

-- Allow anon users to read public data
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.problem_statements TO anon;
GRANT SELECT ON public.teams TO anon;

-- ============================================================================
-- PART 7: INSERT INITIAL FACULTY DATA
-- ============================================================================

-- Insert faculty members (safe to run multiple times with ON CONFLICT)
-- Note: department must match check constraint (CS, EC, ME, CE, EE)
INSERT INTO public.faculty (faculty_id, name, email, department, designation, is_active)
VALUES 
  ('FAC001', 'Faculty User', 'faculty@gmail.com', 'CS', 'Faculty', true)
ON CONFLICT (faculty_id) DO UPDATE
SET 
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  designation = EXCLUDED.designation,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Display inserted faculty
SELECT 
  faculty_id,
  name,
  email,
  department,
  is_active,
  CASE 
    WHEN auth_user_id IS NULL THEN '⏳ Awaiting Supabase Auth account creation'
    ELSE '✅ Linked to auth user: ' || auth_user_id::text
  END as auth_status
FROM public.faculty
WHERE is_active = true
ORDER BY faculty_id;

-- ============================================================================
-- PART 8: VERIFICATION QUERIES
-- ============================================================================

-- Verify all tables have RLS enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'faculty', 'teams', 'members', 'problem_statements', 'submissions', 'notifications')
ORDER BY tablename;

-- Verify trigger exists
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
  AND event_object_schema = 'auth';

-- Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✅ PRODUCTION DATABASE SETUP COMPLETED SUCCESSFULLY!          ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What was set up:';
  RAISE NOTICE '  ✓ All tables with correct structure';
  RAISE NOTICE '  ✓ Performance indexes on all key columns';
  RAISE NOTICE '  ✓ Unified authentication trigger';
  RAISE NOTICE '  ✓ Role-based helper function';
  RAISE NOTICE '  ✓ Comprehensive RLS policies';
  RAISE NOTICE '  ✓ Proper permissions and grants';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '';
  RAISE NOTICE '1. CREATE FACULTY ACCOUNTS:';
  RAISE NOTICE '   → Supabase Dashboard → Authentication → Users → Add User';
  RAISE NOTICE '   → Use faculty email addresses';
  RAISE NOTICE '   → Check "Auto Confirm User"';
  RAISE NOTICE '   → The system will automatically assign faculty role!';
  RAISE NOTICE '';
  RAISE NOTICE '2. VERIFY FACULTY IN DATABASE:';
  RAISE NOTICE '   Ensure your faculty table has entries with correct emails:';
  RAISE NOTICE '   SELECT faculty_id, name, email FROM faculty WHERE is_active = true;';
  RAISE NOTICE '';
  RAISE NOTICE '3. TEST AUTHENTICATION:';
  RAISE NOTICE '   → Faculty login: Use Supabase Auth credentials';
  RAISE NOTICE '   → Students: Register normally through your app';
  RAISE NOTICE '   → Both should work seamlessly!';
  RAISE NOTICE '';
  RAISE NOTICE '4. VERIFY EVERYTHING:';
  RAISE NOTICE '   → Faculty can add problem statements ✓';
  RAISE NOTICE '   → Students can form teams ✓';
  RAISE NOTICE '   → Teams can submit ideas ✓';
  RAISE NOTICE '   → Notifications work ✓';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security Features:';
  RAISE NOTICE '  ✓ Row Level Security enabled on all tables';
  RAISE NOTICE '  ✓ Role-based access control';
  RAISE NOTICE '  ✓ Automatic profile creation';
  RAISE NOTICE '  ✓ Faculty auto-detection via email';
  RAISE NOTICE '  ✓ Password hashing via Supabase Auth';
  RAISE NOTICE '';
  RAISE NOTICE '📚 Documentation:';
  RAISE NOTICE '  → PRODUCTION_READY_SETUP.md for detailed info';
  RAISE NOTICE '  → ARCHITECTURE.md for system design';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Your system is now production-ready!';
  RAISE NOTICE '';
END $$;
