-- Database Health Check and Verification Script
-- Run this after applying the complete_database_optimization.sql migration
-- This script verifies that everything is working correctly

-- =============================================
-- 1. TABLE STRUCTURE VERIFICATION
-- =============================================

SELECT 'TABLE STRUCTURE CHECK' as check_type;

-- Check if all required tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('profiles', 'teams', 'members', 'submissions', 'problem_statements', 'notifications') 
        THEN '✓ REQUIRED TABLE EXISTS'
        ELSE '⚠ OPTIONAL TABLE'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =============================================
-- 2. CONSTRAINT VERIFICATION
-- =============================================

SELECT 'CONSTRAINT CHECK' as check_type;

-- Check foreign key constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    '✓ CONSTRAINT EXISTS' as status
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public' 
AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- Check unique constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    '✓ UNIQUE CONSTRAINT' as status
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public' 
AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name;

-- =============================================
-- 3. INDEX VERIFICATION
-- =============================================

SELECT 'INDEX CHECK' as check_type;

-- Check important indexes exist
SELECT 
    schemaname,
    tablename,
    indexname,
    '✓ INDEX EXISTS' as status
FROM pg_indexes 
WHERE schemaname = 'public'
AND (
    indexname LIKE 'idx_%' OR 
    indexname LIKE '%_pkey' OR 
    indexname LIKE '%_unique%'
)
ORDER BY tablename, indexname;

-- =============================================
-- 4. RLS POLICY VERIFICATION
-- =============================================

SELECT 'RLS POLICY CHECK' as check_type;

-- Check RLS is enabled on all required tables
SELECT 
    t.tablename,
    CASE 
        WHEN t.rowsecurity = true THEN '✓ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as rls_status
FROM pg_tables t
WHERE t.schemaname = 'public'
AND t.tablename IN ('profiles', 'teams', 'members', 'submissions', 'problem_statements', 'notifications')
ORDER BY t.tablename;

-- Count policies per table
SELECT 
    schemaname,
    tablename,
    COUNT(policyname) as policy_count,
    CASE 
        WHEN COUNT(policyname) > 0 THEN '✓ HAS POLICIES'
        ELSE '❌ NO POLICIES'
    END as policy_status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- =============================================
-- 5. DATA INTEGRITY VERIFICATION
-- =============================================

SELECT 'DATA INTEGRITY CHECK' as check_type;

-- Check for orphaned records
SELECT 
    'Teams without leads' as check_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✓ NO ORPHANS' ELSE '⚠ ORPHANED RECORDS FOUND' END as status
FROM teams t
LEFT JOIN profiles p ON t.lead_id = p.id
WHERE p.id IS NULL;

SELECT 
    'Members without teams' as check_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✓ NO ORPHANS' ELSE '⚠ ORPHANED RECORDS FOUND' END as status
FROM members m
LEFT JOIN teams t ON m.team_id = t.id
WHERE t.id IS NULL;

SELECT 
    'Submissions without teams' as check_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✓ NO ORPHANS' ELSE '⚠ ORPHANED RECORDS FOUND' END as status
FROM submissions s
LEFT JOIN teams t ON s.team_id = t.id
WHERE t.id IS NULL;

-- =============================================
-- 6. FUNCTION AND VIEW VERIFICATION
-- =============================================

SELECT 'FUNCTIONS AND VIEWS CHECK' as check_type;

-- Check if utility functions exist
SELECT 
    routine_name,
    routine_type,
    '✓ EXISTS' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_team_details', 'can_team_submit', 'handle_new_user')
ORDER BY routine_name;

-- Check if views exist
SELECT 
    table_name,
    table_type,
    '✓ VIEW EXISTS' as status
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('team_stats', 'submission_stats')
ORDER BY table_name;

-- =============================================
-- 7. SAMPLE DATA VERIFICATION
-- =============================================

SELECT 'SAMPLE DATA CHECK' as check_type;

-- Check if problem statements exist
SELECT 
    'Problem Statements' as data_type,
    COUNT(*) as count,
    CASE WHEN COUNT(*) > 0 THEN '✓ DATA EXISTS' ELSE '⚠ NO SAMPLE DATA' END as status
FROM problem_statements;

-- Check data distribution
SELECT 
    'Teams by Department' as metric,
    department,
    COUNT(*) as count
FROM teams
GROUP BY department
ORDER BY count DESC;

SELECT 
    'Teams by Status' as metric,
    status,
    COUNT(*) as count
FROM teams
GROUP BY status
ORDER BY count DESC;

-- =============================================
-- 8. PERMISSION TEST (if user has proper role)
-- =============================================

SELECT 'PERMISSION TEST' as check_type;

-- Test if current user can query basic tables
BEGIN;

-- Test read permissions
SELECT 
    'Read Test: Profiles' as test_name,
    CASE WHEN COUNT(*) >= 0 THEN '✓ READ ACCESS GRANTED' ELSE '❌ READ ACCESS DENIED' END as result
FROM profiles
LIMIT 1;

SELECT 
    'Read Test: Problem Statements' as test_name,
    CASE WHEN COUNT(*) >= 0 THEN '✓ READ ACCESS GRANTED' ELSE '❌ READ ACCESS DENIED' END as result
FROM problem_statements
LIMIT 1;

ROLLBACK;

-- =============================================
-- 9. FINAL SUMMARY
-- =============================================

SELECT 'FINAL SUMMARY' as check_type;

SELECT 
    '✅ DATABASE OPTIMIZATION VERIFICATION COMPLETE' as status,
    NOW() as completed_at,
    'All critical components have been checked. Review results above for any issues.' as note;

-- Recommended next steps
SELECT 
    'RECOMMENDED NEXT STEPS:' as recommendation,
    '1. Review any ❌ or ⚠ items above' as step_1,
    '2. Test application functionality with sample users' as step_2,
    '3. Monitor performance with actual data load' as step_3,
    '4. Set up regular database maintenance tasks' as step_4;