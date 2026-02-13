-- Quick Database Check - run this in Supabase SQL Editor to see current state

-- Check if tables exist and have data
SELECT 'TABLES STATUS:' as info;

SELECT 'teams' as table_name, count(*) as record_count, 
       COUNT(CASE WHEN lead_id IS NOT NULL THEN 1 END) as teams_with_leads
FROM teams;

SELECT 'profiles' as table_name, count(*) as record_count,
       COUNT(CASE WHEN role = 'lead' THEN 1 END) as lead_profiles,
       COUNT(CASE WHEN role = 'faculty' THEN 1 END) as faculty_profiles
FROM profiles;

SELECT 'members' as table_name, count(*) as record_count
FROM members;

-- Check for problem_statements table (might not exist)
SELECT 'problem_statements' as table_name, 
       CASE 
           WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'problem_statements') 
           THEN count(*)::text 
           ELSE 'TABLE DOES NOT EXIST' 
       END as record_count
FROM information_schema.tables 
LEFT JOIN problem_statements ON true
WHERE table_name = 'problem_statements' OR table_name IS NULL
GROUP BY table_name
LIMIT 1;

-- Check for submissions table (might not exist)
SELECT 'submissions' as table_name, 
       CASE 
           WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'submissions') 
           THEN count(*)::text 
           ELSE 'TABLE DOES NOT EXIST' 
       END as record_count
FROM information_schema.tables 
LEFT JOIN submissions ON true
WHERE table_name = 'submissions' OR table_name IS NULL
GROUP BY table_name
LIMIT 1;

SELECT 'DATA RELATIONSHIPS:' as info;

-- Check teams without profiles
SELECT 'Teams missing lead profiles:' as issue,
       count(*) as count
FROM teams t
LEFT JOIN profiles p ON t.lead_id = p.id
WHERE t.lead_id IS NOT NULL AND p.id IS NULL;

-- Sample team data to see structure
SELECT 'SAMPLE TEAM DATA:' as info;
SELECT 
    t.id,
    t.name,
    t.department,
    t.year,
    t.section,
    t.status,
    t.lead_id,
    p.full_name as lead_name,
    p.email as lead_email
FROM teams t
LEFT JOIN profiles p ON t.lead_id = p.id
LIMIT 3;