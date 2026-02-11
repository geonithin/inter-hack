-- ============================================================================
-- DIAGNOSE FACULTY PROBLEM STATEMENT ERROR
-- ============================================================================
-- Run this to check your current database state and identify the 400 error cause
-- ============================================================================

-- Check 1: Does problem_statements table exist?
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'problem_statements') THEN
    RAISE NOTICE '✅ problem_statements table EXISTS';
  ELSE
    RAISE NOTICE '❌ problem_statements table MISSING - Run complete_production_setup.sql';
  END IF;
END $$;

-- Check 2: What columns does it have?
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'problem_statements'
ORDER BY ordinal_position;

-- Check 3: Are RLS policies enabled?
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'problem_statements';

-- Check 4: What RLS policies exist for problem_statements?
SELECT 
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'problem_statements';

-- Check 5: Is the faculty user set up correctly?
SELECT 
  f.faculty_id,
  f.name,
  f.email,
  f.auth_user_id,
  f.is_active,
  p.role,
  CASE 
    WHEN f.auth_user_id IS NULL THEN '❌ No auth_user_id - Need to login with Supabase Auth'
    WHEN p.role IS NULL THEN '❌ No profile exists - Login once to create'
    WHEN p.role != 'faculty' THEN '⚠️ Wrong role: ' || p.role
    ELSE '✅ Configured correctly'
  END as status
FROM faculty f
LEFT JOIN profiles p ON f.auth_user_id = p.id
WHERE f.email = 'faculty@gmail.com';

-- Check 6: Can current user insert? (Run this while logged in as faculty)
SELECT 
  current_user as db_user,
  auth.uid() as auth_user_id,
  auth.jwt() ->> 'role' as jwt_role;

-- ============================================================================
-- RESULTS INTERPRETATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 HOW TO INTERPRET RESULTS:';
  RAISE NOTICE '';
  RAISE NOTICE '1. If problem_statements table is MISSING:';
  RAISE NOTICE '   → Run complete_production_setup.sql';
  RAISE NOTICE '';
  RAISE NOTICE '2. If RLS is enabled but no policies exist:';
  RAISE NOTICE '   → Run complete_production_setup.sql (it creates policies)';
  RAISE NOTICE '';
  RAISE NOTICE '3. If faculty has no auth_user_id:';
  RAISE NOTICE '   → Create Supabase Auth account for faculty@gmail.com';
  RAISE NOTICE '   → Login once to link accounts';
  RAISE NOTICE '';
  RAISE NOTICE '4. If profile role is wrong:';
  RAISE NOTICE '   → Update: UPDATE profiles SET role = ''faculty'' WHERE id = auth.uid()';
  RAISE NOTICE '';
END $$;
