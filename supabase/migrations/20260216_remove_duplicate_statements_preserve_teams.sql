-- Migration: Remove Duplicate Problem Statements While Preserving Team Selections
-- Date: 2026-02-16
-- Description: Removes duplicate problem statements from the database while ensuring
--              teams that have already selected statements are not affected

BEGIN;

-- Step 1: Create a temporary table to identify which statement ID to keep for each title
CREATE TEMP TABLE statements_to_keep AS
SELECT DISTINCT ON (title)
    id,
    title,
    description,
    department,
    max_teams,
    is_active,
    created_at
FROM problem_statements
ORDER BY title, 
         -- Prioritize statements that have been selected by teams
         (SELECT COUNT(*) FROM teams WHERE selected_statement_id = problem_statements.id) DESC,
         -- Then prioritize older statements
         created_at ASC;

-- Step 2: Create a mapping of old IDs to the IDs we want to keep
CREATE TEMP TABLE statement_id_mapping AS
SELECT 
    ps.id AS old_id,
    stk.id AS new_id
FROM problem_statements ps
JOIN statements_to_keep stk ON ps.title = stk.title
WHERE ps.id != stk.id;

-- Step 3: Update teams table to point to the correct statement IDs
-- This ensures no team loses their selection
UPDATE teams
SET selected_statement_id = sim.new_id
FROM statement_id_mapping sim
WHERE teams.selected_statement_id = sim.old_id;

-- Step 4: Update submissions table to point to the correct statement IDs
-- This ensures submission history is preserved
UPDATE submissions
SET statement_id = sim.new_id
FROM statement_id_mapping sim
WHERE submissions.statement_id = sim.old_id;

-- Step 5: Delete duplicate problem statements
DELETE FROM problem_statements
WHERE id IN (SELECT old_id FROM statement_id_mapping);

-- Step 6: Add unique constraint on title to prevent future duplicates
-- Drop if exists first (in case it was added before)
ALTER TABLE problem_statements 
DROP CONSTRAINT IF EXISTS problem_statements_title_unique;

ALTER TABLE problem_statements 
ADD CONSTRAINT problem_statements_title_unique UNIQUE (title);

-- Step 7: Verify the cleanup
DO $$
DECLARE
    total_statements INTEGER;
    duplicate_count INTEGER;
    affected_teams INTEGER;
BEGIN
    -- Count total statements
    SELECT COUNT(*) INTO total_statements FROM problem_statements;
    
    -- Check for any remaining duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT title, COUNT(*) as cnt
        FROM problem_statements
        GROUP BY title
        HAVING COUNT(*) > 1
    ) duplicates;
    
    -- Count teams with selections
    SELECT COUNT(*) INTO affected_teams
    FROM teams
    WHERE selected_statement_id IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Duplicate Removal Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total problem statements: %', total_statements;
    RAISE NOTICE 'Remaining duplicates: %', duplicate_count;
    RAISE NOTICE 'Teams with selections preserved: %', affected_teams;
    RAISE NOTICE '';
    
    IF duplicate_count > 0 THEN
        RAISE WARNING 'There are still % duplicate titles. Manual review may be needed.', duplicate_count;
    ELSE
        RAISE NOTICE '✅ All duplicates successfully removed!';
    END IF;
END $$;

COMMIT;

-- Final verification query (run manually if needed)
-- SELECT title, COUNT(*) as count 
-- FROM problem_statements 
-- GROUP BY title 
-- HAVING COUNT(*) > 1;
