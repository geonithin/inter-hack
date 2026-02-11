-- ============================================================================
-- TEMPORARY FIX FOR LEGACY FACULTY AUTHENTICATION
-- ============================================================================
-- This script temporarily relaxes RLS policies to allow legacy faculty auth
-- to work while you complete the migration to Supabase Auth.
--
-- ⚠️ WARNING: This is a TEMPORARY workaround for development/migration period
-- ⚠️ Complete the full migration ASAP for production security
--
-- Run this AFTER production_ready_rls_fix.sql if faculty still can't add 
-- problem statements
-- ============================================================================

BEGIN;

-- ============================================================================
-- OPTION 1: Allow any authenticated user to insert (MOST PERMISSIVE)
-- ============================================================================
-- This allows anyone with ANY auth session to insert problem statements
-- Use this if you need immediate functionality during migration

DROP POLICY IF EXISTS "Faculty can insert problem statements" ON public.problem_statements;

CREATE POLICY "Faculty can insert problem statements"
  ON public.problem_statements
  FOR INSERT
  WITH CHECK (
    -- Allow if user has proper Supabase Auth with faculty role
    get_current_user_role() IN ('faculty', 'admin') OR
    -- OR allow any authenticated user (for legacy faculty)
    auth.uid() IS NOT NULL
  );

-- ============================================================================
-- OPTION 2: Temporarily disable RLS on problem_statements (LEAST SECURE)
-- ============================================================================
-- Uncomment these lines if Option 1 still doesn't work
-- This completely disables security checks - USE ONLY FOR TESTING!

-- ALTER TABLE public.problem_statements DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Verify the policy was updated
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'problem_statements'
ORDER BY policyname;

COMMIT;

-- ============================================================================
-- IMPORTANT NEXT STEPS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Temporary fix applied - faculty should now be able to add problem statements';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: This is a temporary workaround!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Complete these steps ASAP for production security:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Run faculty_auth_migration.sql to set up proper auth integration';
  RAISE NOTICE '';
  RAISE NOTICE '2. Create Supabase Auth accounts for all faculty:';
  RAISE NOTICE '   → Supabase Dashboard → Authentication → Users → Invite User';
  RAISE NOTICE '   → Use their faculty email addresses';
  RAISE NOTICE '';
  RAISE NOTICE '3. Have faculty login with Supabase Auth credentials';
  RAISE NOTICE '';
  RAISE NOTICE '4. Once all faculty are migrated, re-run production_ready_rls_fix.sql';
  RAISE NOTICE '   to restore proper security policies';
  RAISE NOTICE '';
  RAISE NOTICE '📚 See QUICK_START_PRODUCTION.md for detailed migration guide';
END $$;
