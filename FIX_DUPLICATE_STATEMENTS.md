# Fix Duplicate Problem Statements

## Problem
Problem statements are displaying twice in the dashboard because there are duplicate entries in the database with the same titles but different IDs.

## Solution
Run the migration script that will:
1. ✅ Identify and remove duplicate problem statements
2. ✅ Preserve all team selections (no team will lose their choice)
3. ✅ Preserve submission history
4. ✅ Add a unique constraint to prevent future duplicates

## How to Apply the Fix

### Step 1: Run the Migration
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open and run this migration file:
   ```
   supabase/migrations/20260216_remove_duplicate_statements_preserve_teams.sql
   ```

### Step 2: Verify the Fix
After running the migration, you should see output like:
```
========================================
Duplicate Removal Complete!
========================================
Total problem statements: XX
Remaining duplicates: 0
Teams with selections preserved: XX
✅ All duplicates successfully removed!
```

### Step 3: Refresh the Dashboard
- Refresh your browser (Ctrl+R or Cmd+R)
- Check Dashboard, FacultyDashboard, and TeamDetails pages
- Each problem statement should now appear only once

## What the Migration Does

1. **Identifies duplicates**: Finds all problem statements with the same title
2. **Chooses which to keep**: Prioritizes statements that:
   - Have been selected by teams (most important)
   - Are older (created first)
3. **Updates references**: Updates all team selections and submissions to point to the kept statement
4. **Removes duplicates**: Deletes the duplicate entries
5. **Prevents future duplicates**: Adds a unique constraint on the title column

## Safety Features

✅ **Teams protected**: No team will lose their statement selection
✅ **Submissions protected**: All submission history is preserved
✅ **Transactional**: If anything goes wrong, all changes are rolled back

## No Action Needed For

❌ The hardcoded `PROBLEM_DATA` in AdminDashboard.jsx (it's just dummy data for UI mockup)
✅ The actual database duplicates (fixed by the migration)

## If You Still See Duplicates

If you still see duplicates after running the migration:
1. Check the migration output for any warnings
2. Run this query in SQL Editor to check for remaining duplicates:
   ```sql
   SELECT title, COUNT(*) as count 
   FROM problem_statements 
   GROUP BY title 
   HAVING COUNT(*) > 1;
   ```
3. If any duplicates remain, contact support with the output

## Future Protection

After running this migration:
- ✅ The database will prevent inserting duplicate titles automatically
- ✅ The `20260216_add_civil_mba_problem_statements.sql` migration already has `WHERE NOT EXISTS` checks that work with this fix
- ✅ Any future attempts to add duplicate titles will be rejected

