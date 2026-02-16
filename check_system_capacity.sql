-- System Capacity & Usage Monitoring Script
-- Run this periodically to check your system's current usage and capacity

-- =============================================
-- 1. DATABASE SIZE OVERVIEW
-- =============================================
SELECT '🗄️ DATABASE SIZE' as section;

SELECT 
    pg_size_pretty(pg_database_size(current_database())) as "Total Database Size",
    pg_size_pretty(pg_database_size(current_database()) * 100 / (1024 * 1024 * 500)::bigint) || '%' as "Free Tier Usage (500MB)",
    CASE 
        WHEN pg_database_size(current_database()) < 400 * 1024 * 1024 THEN '✅ Healthy'
        WHEN pg_database_size(current_database()) < 450 * 1024 * 1024 THEN '⚠️ Monitor'
        ELSE '❌ Consider upgrading'
    END as "Status"
;

-- =============================================
-- 2. TABLE SIZES
-- =============================================
SELECT '📊 TABLE SIZES' as section;

SELECT 
    tablename as "Table",
    pg_size_pretty(pg_total_relation_size('public.' || tablename)) as "Size",
    pg_size_pretty(pg_indexes_size('public.' || tablename)) as "Index Size",
    CASE 
        WHEN pg_total_relation_size('public.' || tablename) > 100 * 1024 * 1024 THEN '⚠️ Large'
        WHEN pg_total_relation_size('public.' || tablename) > 10 * 1024 * 1024 THEN '✓ Medium'
        ELSE '✓ Small'
    END as "Status"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;

-- =============================================
-- 3. RECORD COUNTS
-- =============================================
SELECT '📈 RECORD COUNTS' as section;

SELECT 
    'Teams' as "Entity",
    COUNT(*) as "Count",
    '10,000' as "Comfortable Limit",
    ROUND((COUNT(*) * 100.0 / 10000), 2)::text || '%' as "Usage",
    CASE 
        WHEN COUNT(*) < 5000 THEN '✅ Excellent'
        WHEN COUNT(*) < 8000 THEN '✓ Good'
        WHEN COUNT(*) < 10000 THEN '⚠️ Monitor'
        ELSE '❌ Consider optimization'
    END as "Status"
FROM teams
UNION ALL
SELECT 
    'Members',
    COUNT(*),
    '50,000',
    ROUND((COUNT(*) * 100.0 / 50000), 2)::text || '%',
    CASE 
        WHEN COUNT(*) < 25000 THEN '✅ Excellent'
        WHEN COUNT(*) < 40000 THEN '✓ Good'
        WHEN COUNT(*) < 50000 THEN '⚠️ Monitor'
        ELSE '❌ Consider optimization'
    END
FROM members
UNION ALL
SELECT 
    'Problem Statements',
    COUNT(*),
    '1,000',
    ROUND((COUNT(*) * 100.0 / 1000), 2)::text || '%',
    CASE 
        WHEN COUNT(*) < 500 THEN '✅ Excellent'
        WHEN COUNT(*) < 800 THEN '✓ Good'
        WHEN COUNT(*) < 1000 THEN '⚠️ Monitor'
        ELSE '❌ Consider optimization'
    END
FROM problem_statements
UNION ALL
SELECT 
    'Submissions',
    COUNT(*),
    '10,000',
    ROUND((COUNT(*) * 100.0 / 10000), 2)::text || '%',
    CASE 
        WHEN COUNT(*) < 5000 THEN '✅ Excellent'
        WHEN COUNT(*) < 8000 THEN '✓ Good'
        WHEN COUNT(*) < 10000 THEN '⚠️ Monitor'
        ELSE '❌ Consider optimization'
    END
FROM submissions
UNION ALL
SELECT 
    'Notifications',
    COUNT(*),
    '100,000',
    ROUND((COUNT(*) * 100.0 / 100000), 2)::text || '%',
    CASE 
        WHEN COUNT(*) < 50000 THEN '✅ Excellent'
        WHEN COUNT(*) < 80000 THEN '✓ Good'
        WHEN COUNT(*) < 100000 THEN '⚠️ Monitor'
        ELSE '❌ Consider archiving'
    END
FROM notifications
UNION ALL
SELECT 
    'Profiles',
    COUNT(*),
    '50,000',
    ROUND((COUNT(*) * 100.0 / 50000), 2)::text || '%',
    CASE 
        WHEN COUNT(*) < 25000 THEN '✅ Excellent'
        WHEN COUNT(*) < 40000 THEN '✓ Good'
        WHEN COUNT(*) < 50000 THEN '⚠️ Monitor'
        ELSE '❌ Consider optimization'
    END
FROM profiles;

-- =============================================
-- 4. TEAM STATISTICS
-- =============================================
SELECT '👥 TEAM STATISTICS' as section;

SELECT 
    COUNT(*) as "Total Teams",
    COUNT(CASE WHEN selected_statement_id IS NOT NULL THEN 1 END) as "Teams with Selection",
    COUNT(DISTINCT department) as "Active Departments",
    COUNT(DISTINCT year) as "Active Years",
    ROUND(AVG((SELECT COUNT(*) FROM members WHERE members.team_id = teams.id)), 2) as "Avg Members per Team"
FROM teams;

-- Department breakdown
SELECT 
    department as "Department",
    COUNT(*) as "Teams",
    COUNT(CASE WHEN selected_statement_id IS NOT NULL THEN 1 END) as "With Selection",
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM teams), 2)::text || '%' as "Percentage"
FROM teams
WHERE department IS NOT NULL
GROUP BY department
ORDER BY COUNT(*) DESC;

-- =============================================
-- 5. PROBLEM STATEMENT STATISTICS
-- =============================================
SELECT '📝 PROBLEM STATEMENT STATISTICS' as section;

SELECT 
    COUNT(*) as "Total Statements",
    COUNT(CASE WHEN is_active = true THEN 1 END) as "Active",
    COUNT(CASE WHEN is_active = false THEN 1 END) as "Inactive",
    ROUND(AVG(max_teams), 2) as "Avg Max Teams",
    SUM(max_teams) as "Total Available Slots"
FROM problem_statements;

-- Capacity utilization
SELECT 
    ps.title as "Statement",
    ps.max_teams as "Max Teams",
    COUNT(t.id) as "Selected By",
    ps.max_teams - COUNT(t.id) as "Remaining Capacity",
    ROUND((COUNT(t.id) * 100.0 / ps.max_teams), 2)::text || '%' as "Utilization",
    CASE 
        WHEN COUNT(t.id) >= ps.max_teams THEN '🔴 Full'
        WHEN COUNT(t.id) >= ps.max_teams * 0.8 THEN '🟡 Almost Full'
        WHEN COUNT(t.id) > 0 THEN '🟢 Available'
        ELSE '⚪ Empty'
    END as "Status"
FROM problem_statements ps
LEFT JOIN teams t ON t.selected_statement_id = ps.id
WHERE ps.is_active = true
GROUP BY ps.id, ps.title, ps.max_teams
ORDER BY (COUNT(t.id) * 100.0 / ps.max_teams) DESC
LIMIT 10;

-- =============================================
-- 6. SUBMISSION STATISTICS
-- =============================================
SELECT '📤 SUBMISSION STATISTICS' as section;

SELECT 
    status as "Status",
    COUNT(*) as "Count",
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM submissions WHERE status IS NOT NULL), 2)::text || '%' as "Percentage"
FROM submissions
WHERE status IS NOT NULL
GROUP BY status
ORDER BY COUNT(*) DESC;

-- =============================================
-- 7. NOTIFICATION STATISTICS
-- =============================================
SELECT '🔔 NOTIFICATION STATISTICS' as section;

SELECT 
    COUNT(*) as "Total Notifications",
    COUNT(CASE WHEN is_read = false THEN 1 END) as "Unread",
    COUNT(CASE WHEN is_read = true THEN 1 END) as "Read",
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as "Last 24 Hours",
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as "Last 7 Days",
    COUNT(CASE WHEN created_at < NOW() - INTERVAL '30 days' THEN 1 END) as "Older than 30 Days (Consider Archiving)"
FROM notifications;

-- Notification type breakdown
SELECT 
    type as "Type",
    COUNT(*) as "Count",
    COUNT(CASE WHEN is_read = false THEN 1 END) as "Unread"
FROM notifications
GROUP BY type
ORDER BY COUNT(*) DESC;

-- =============================================
-- 8. PERFORMANCE INDICATORS
-- =============================================
SELECT '⚡ PERFORMANCE INDICATORS' as section;

-- Index usage statistics
SELECT 
    schemaname as "Schema",
    tablename as "Table",
    indexname as "Index",
    idx_scan as "Index Scans",
    CASE 
        WHEN idx_scan = 0 THEN '❌ Unused'
        WHEN idx_scan < 100 THEN '⚠️ Rarely Used'
        WHEN idx_scan < 1000 THEN '✓ Used'
        ELSE '✅ Heavily Used'
    END as "Status"
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 15;

-- =============================================
-- 9. DATA INTEGRITY CHECK
-- =============================================
SELECT '🔍 DATA INTEGRITY' as section;

-- Check for orphaned records
SELECT 
    'Teams without leads' as "Check",
    COUNT(*) as "Count",
    CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ Issue Found' END as "Status"
FROM teams t
LEFT JOIN profiles p ON t.lead_id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 
    'Members without teams',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ Issue Found' END
FROM members m
LEFT JOIN teams t ON m.team_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 
    'Submissions without teams',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ Issue Found' END
FROM submissions s
LEFT JOIN teams t ON s.team_id = t.id
WHERE t.id IS NULL;

-- =============================================
-- 10. RECOMMENDATIONS
-- =============================================
SELECT '💡 RECOMMENDATIONS' as section;

DO $$
DECLARE
    db_size bigint;
    team_count bigint;
    notification_count bigint;
    old_notifications bigint;
BEGIN
    SELECT pg_database_size(current_database()) INTO db_size;
    SELECT COUNT(*) INTO team_count FROM teams;
    SELECT COUNT(*) INTO notification_count FROM notifications;
    SELECT COUNT(*) INTO old_notifications FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE 'SYSTEM CAPACITY RECOMMENDATIONS';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE '';
    
    -- Database size recommendations
    IF db_size > 450 * 1024 * 1024 THEN
        RAISE NOTICE '❌ Database size is > 450MB. Action: Upgrade to Pro tier ($25/mo)';
    ELSIF db_size > 400 * 1024 * 1024 THEN
        RAISE NOTICE '⚠️  Database size is > 400MB. Action: Monitor closely, plan upgrade';
    ELSE
        RAISE NOTICE '✅ Database size is healthy (< 400MB)';
    END IF;
    
    -- Team count recommendations
    IF team_count > 8000 THEN
        RAISE NOTICE '❌ Team count is > 8,000. Action: Review indexing strategy';
    ELSIF team_count > 5000 THEN
        RAISE NOTICE '⚠️  Team count is > 5,000. Action: Monitor query performance';
    ELSE
        RAISE NOTICE '✅ Team count is healthy (< 5,000)';
    END IF;
    
    -- Notification recommendations
    IF old_notifications > 10000 THEN
        RAISE NOTICE '❌ % old notifications found. Action: Implement archiving', old_notifications;
    ELSIF old_notifications > 5000 THEN
        RAISE NOTICE '⚠️  % old notifications found. Action: Consider archiving', old_notifications;
    ELSE
        RAISE NOTICE '✅ Notification count is manageable';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'For detailed capacity information, see: SYSTEM_CAPACITY_ANALYSIS.md';
    RAISE NOTICE '';
END $$;
