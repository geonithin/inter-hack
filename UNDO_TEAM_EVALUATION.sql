-- ================================================================
-- QUICK FIX: Undo Team Evaluation
-- ================================================================
-- Use this to quickly revert a team's status back to Pending
-- Replace 'TEAM_NAME_HERE' with the actual team name
-- ================================================================

-- Option 1: Reset by team name
UPDATE teams 
SET status = 'Pending', 
    updated_at = NOW()
WHERE name = 'TEAM_NAME_HERE';

-- Option 2: Reset by team ID (if you know the UUID)
-- UPDATE teams 
-- SET status = 'Pending', 
--     updated_at = NOW()
-- WHERE id = 'team-uuid-here';

-- ================================================================
-- To find the team name if you're not sure:
-- ================================================================
SELECT id, name, status, department, year 
FROM teams 
WHERE status IN ('Selected', 'Rejected')
ORDER BY name;

-- ================================================================
-- View evaluation history for a team:
-- ================================================================
SELECT 
    teh.action,
    teh.faculty_name,
    teh.reason,
    teh.created_at,
    t.name as team_name
FROM team_evaluation_history teh
JOIN teams t ON t.id = teh.team_id
WHERE t.name = 'TEAM_NAME_HERE'
ORDER BY teh.created_at DESC;

-- ================================================================
-- OPTIONAL: Delete evaluation history for this team
-- (Only do this if you want to completely remove history)
-- ================================================================
-- DELETE FROM team_evaluation_history 
-- WHERE team_id = (SELECT id FROM teams WHERE name = 'TEAM_NAME_HERE');

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================
SELECT 
  '✅ Team status reset to Pending' as status,
  'The team can now be re-evaluated with the correct decision' as message;
