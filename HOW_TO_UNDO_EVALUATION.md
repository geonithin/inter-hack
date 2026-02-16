# How to Undo Team Evaluations

## Problem
You accidentally selected/rejected the wrong team and need to undo it.

## Solutions

### Solution 1: Use the UI (Recommended)
The faculty dashboard now has a **"Reset to Pending"** button for evaluated teams:

1. Go to Faculty Dashboard
2. Find the team you want to undo
3. Look in the Status column - you'll see:
   - Current status badge (Selected or Rejected)
   - **"Reset to Pending"** button (yellow/amber button)
4. Click **"Reset to Pending"**
5. Confirm the action
6. Team status returns to "Pending"
7. Team can now be re-evaluated with the correct decision

**Note**: All buttons are now enabled, so you can also directly:
- Click **"Re-Select"** to select again with a new reason
- Click **"Re-Reject"** to reject again with a new reason

### Solution 2: Quick SQL Fix
If you need to fix it immediately from the database:

1. Open Supabase Dashboard → SQL Editor
2. Use this query (replace `TEAM_NAME_HERE` with the actual team name):

```sql
UPDATE teams 
SET status = 'Pending', 
    updated_at = NOW()
WHERE name = 'TEAM_NAME_HERE';
```

**Find team names:**
```sql
SELECT id, name, status, department 
FROM teams 
WHERE status IN ('Selected', 'Rejected')
ORDER BY name;
```

**Full SQL file**: See [UNDO_TEAM_EVALUATION.sql](UNDO_TEAM_EVALUATION.sql)

## What Happens When You Reset

1. ✅ Team status changes to "Pending"
2. ✅ Team lead receives notification about the reset
3. ✅ Faculty can now re-evaluate the team
4. ✅ Previous evaluation history is preserved (for audit trail)
5. ✅ New evaluation will be added to history

## UI Changes Made

### Before
- Select/Reject buttons were **disabled** after evaluation
- No way to undo without database access

### After
- All buttons remain **enabled**
- Button labels change to "Re-Select" / "Re-Reject" for evaluated teams
- New **"Reset to Pending"** button appears for evaluated teams
- Allows complete flexibility in team management

## Features

✅ **No data loss**: Evaluation history is preserved
✅ **Team notification**: Lead is notified when status is reset
✅ **Confirmation dialog**: Prevents accidental resets
✅ **Flexible re-evaluation**: Can change decision without resetting
✅ **Audit trail**: All actions are tracked in evaluation history

## Examples

### Example 1: Wrong Team Selected
Team "Alpha Devs" was selected by mistake (meant to select "Beta Devs"):

**Option A** - Reset and start fresh:
1. Click "Reset to Pending" on Alpha Devs
2. Alpha Devs returns to Pending
3. Select Beta Devs properly

**Option B** - Direct correction:
1. Click "Reject" on Alpha Devs
2. Enter reason: "Selected by mistake, team does not meet criteria"
3. Select Beta Devs properly

### Example 2: Changed Mind After Rejection
Team "Gamma Squad" was rejected but should be selected:

1. Click "Re-Select" button (no need to reset)
2. Enter faculty name and new reason
3. Status changes to Selected
4. Both evaluations appear in history

## Evaluation History

All actions are tracked:
- Original selection/rejection with reason
- Reset to Pending action
- New evaluation with new reason

This provides complete transparency and accountability.

## Important Notes

⚠️ **History is Preserved**: Resetting to Pending doesn't delete evaluation history
⚠️ **Team Notification**: Team lead is notified of status changes
⚠️ **Confirmation Required**: You'll be asked to confirm before resetting

## Troubleshooting

### Button not appearing
- Make sure team has been evaluated (not Pending)
- Refresh the page
- Check you're logged in as faculty

### Reset not working
- Check browser console for errors
- Verify faculty role permissions
- Try the SQL method as fallback

### Need to delete evaluation history
See [UNDO_TEAM_EVALUATION.sql](UNDO_TEAM_EVALUATION.sql) for SQL commands to delete history records if needed.

## Summary

The new UI makes it easy to:
- ✅ Undo evaluations with one click
- ✅ Change decisions directly without resetting
- ✅ Maintain full audit trail
- ✅ Keep teams informed

No database access needed for normal undo operations!
