-- Quick script to check for duplicate problem statements
-- Run this BEFORE applying the fix to see the problem
-- Run it AFTER applying the fix to verify it's solved

-- Check 1: Count total problem statements
SELECT 
    'Total Problem Statements' as check_type,
    COUNT(*) as count
FROM problem_statements;

-- Check 2: List duplicate titles
SELECT 
    'Duplicate Titles' as check_type,
    title,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY id) as statement_ids,
    ARRAY_AGG(department ORDER BY id) as departments,
    ARRAY_AGG(created_at ORDER BY id) as created_dates
FROM problem_statements
GROUP BY title
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, title;

-- Check 3: Count teams affected by each duplicate
SELECT 
    'Teams Per Duplicate Statement' as check_type,
    ps.id,
    ps.title,
    ps.department,
    COUNT(t.id) as teams_selected
FROM problem_statements ps
LEFT JOIN teams t ON t.selected_statement_id = ps.id
WHERE ps.title IN (
    SELECT title 
    FROM problem_statements 
    GROUP BY title 
    HAVING COUNT(*) > 1
)
GROUP BY ps.id, ps.title, ps.department
ORDER BY ps.title, teams_selected DESC;

-- Check 4: Summary statistics
SELECT 
    'Summary' as check_type,
    COUNT(DISTINCT title) as unique_titles,
    COUNT(*) as total_statements,
    COUNT(*) - COUNT(DISTINCT title) as duplicate_count,
    (SELECT COUNT(*) FROM teams WHERE selected_statement_id IS NOT NULL) as teams_with_selection
FROM problem_statements;

-- Check 5: Verify unique constraint exists (run after fix)
SELECT 
    'Unique Constraint Check' as check_type,
    constraint_name,
    CASE 
        WHEN constraint_name IS NOT NULL THEN '✅ Constraint exists - duplicates prevented'
        ELSE '❌ No constraint - duplicates possible'
    END as status
FROM information_schema.table_constraints
WHERE table_name = 'problem_statements' 
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%title%';
