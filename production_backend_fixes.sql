-- ============================================================================
-- PRODUCTION BACKEND FIXES
-- ============================================================================
-- This script fixes two critical backend issues:
-- 1. Prevents teams from switching problem statements after submitting ideas
-- 2. Fixes faculty dashboard delete and edit permissions
-- 
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses DROP POLICY IF EXISTS)
-- ============================================================================

BEGIN;

-- ============================================================================
-- FIX 1: Prevent Statement Switching After Submission
-- ============================================================================

-- Drop and recreate the teams update policy to prevent statement switching after submission
DROP POLICY IF EXISTS "teams_update_own" ON public.teams;

CREATE POLICY "teams_update_own" 
  ON public.teams FOR UPDATE 
  USING (
    -- Team lead can update their own team
    auth.uid() = lead_id OR 
    -- Faculty/admin can update any team
    get_current_user_role() IN ('faculty', 'admin')
  )
  WITH CHECK (
    -- Regular updates by team lead
    (auth.uid() = lead_id AND (
      -- Allow ALL updates if no submission exists for this team
      NOT EXISTS (
        SELECT 1 FROM public.submissions 
        WHERE team_id = teams.id
      )
      OR
      -- If submission exists, only allow updates that DON'T change selected_statement_id
      (
        EXISTS (
          SELECT 1 FROM public.submissions 
          WHERE team_id = teams.id
        )
        AND selected_statement_id = (SELECT selected_statement_id FROM public.teams WHERE id = teams.id)
      )
    ))
    OR
    -- Faculty/admin can always update
    get_current_user_role() IN ('faculty', 'admin')
  );

-- ============================================================================
-- FIX 2: Faculty Dashboard Permissions
-- ============================================================================

-- Fix teams delete policy to allow faculty (not just admin)
DROP POLICY IF EXISTS "teams_delete_own" ON public.teams;

CREATE POLICY "teams_delete_own" 
  ON public.teams FOR DELETE 
  USING (
    auth.uid() = lead_id OR 
    get_current_user_role() IN ('faculty', 'admin')
  );

-- Fix problem statements update policy to allow faculty
DROP POLICY IF EXISTS "problem_statements_update_faculty" ON public.problem_statements;

CREATE POLICY "problem_statements_update_faculty" 
  ON public.problem_statements FOR UPDATE 
  USING (
    get_current_user_role() IN ('faculty', 'admin')
  );

-- Fix problem statements delete policy to allow faculty (not just admin)
DROP POLICY IF EXISTS "problem_statements_delete_faculty" ON public.problem_statements;

CREATE POLICY "problem_statements_delete_faculty" 
  ON public.problem_statements FOR DELETE 
  USING (
    get_current_user_role() IN ('faculty', 'admin')
  );

-- Fix members delete policy to ensure faculty can delete when deleting teams
DROP POLICY IF EXISTS "members_delete_team_lead" ON public.members;

CREATE POLICY "members_delete_team_lead" 
  ON public.members FOR DELETE 
  USING (
    auth.uid() IN (SELECT lead_id FROM public.teams WHERE id = team_id) OR
    get_current_user_role() IN ('faculty', 'admin')
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Display current policies for verification
DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'POLICIES UPDATED SUCCESSFULLY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Teams Update Policy: Prevents statement switching after submission';
  RAISE NOTICE 'Teams Delete Policy: Faculty + Admin can delete';
  RAISE NOTICE 'Problem Statements Update: Faculty + Admin can update';
  RAISE NOTICE 'Problem Statements Delete: Faculty + Admin can delete';
  RAISE NOTICE 'Members Delete: Faculty + Admin can delete';
  RAISE NOTICE '';
  RAISE NOTICE 'Run the following query to verify policies:';
  RAISE NOTICE 'SELECT tablename, policyname FROM pg_policies WHERE schemaname = ''public'' ORDER BY tablename;';
END $$;

COMMIT;

-- ============================================================================
-- TESTING QUERIES (Optional - for verification)
-- ============================================================================

-- Check all policies on teams table
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'teams';

-- Check all policies on problem_statements table
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'problem_statements';

-- Check all policies on members table
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'members';
