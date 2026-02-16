# Team Evaluation Feature Implementation Guide

## Overview
This guide explains the new team evaluation feature that requires faculty members to provide their name and reason when selecting or rejecting teams. All evaluations are tracked in the database with full history.

## What's New

### 1. Database Changes
- **New Table**: `team_evaluation_history`
  - Stores all evaluation actions with faculty name and reason
  - Tracks when evaluations were made
  - Links to both teams and faculty profiles
  - Minimum 10 characters required for reasons

### 2. UI Improvements
- **Old UI**: Simple dropdown to change status
- **New UI**: 
  - Clear Select/Reject buttons with icons
  - Professional modal for entering evaluation details
  - Inline display of evaluation history next to each team
  - Disabled buttons for already-processed teams

### 3. Enhanced Faculty Dashboard
- Faculty must provide their name when evaluating
- Mandatory reason (minimum 10 characters) for every decision
- Real-time character count validation
- Full evaluation history displayed per team
- Notifications to team leads include the reason

## Database Migration

### Migration File
Location: `supabase/migrations/20260216_team_evaluation_history.sql`

This migration creates:
1. `team_evaluation_history` table with proper constraints
2. Indexes for performance
3. Row Level Security (RLS) policies
4. Proper permissions

### How to Apply Migration

#### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase/migrations/20260216_team_evaluation_history.sql`
5. Paste into the editor
6. Click **Run** or press `Ctrl+Enter`
7. Verify success message appears

#### Option 2: Supabase CLI
```bash
# Make sure you're in the project directory
cd c:\Users\geoni\inter-hack

# Login to Supabase (if not already logged in)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

#### Option 3: Direct SQL Connection
If you have direct database access:
```bash
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20260216_team_evaluation_history.sql
```

## Features in Detail

### 1. Evaluation Modal
When faculty clicks "Select" or "Reject":
- Modal opens with clear action indicator (green for select, red for reject)
- Team name is displayed
- Faculty name field (pre-filled from user profile if available)
- Reason text area with live character count
- Minimum 10 characters enforced
- Form validation before submission

### 2. Evaluation History Display
For each team in the dashboard:
- Shows up to 3 most recent evaluations
- Color-coded by action (green for Selected, red for Rejected)
- Displays: Faculty name, reason, timestamp
- Scrollable if more than 3 evaluations
- Only visible when history exists

### 3. Status Indicators
- **Pending**: Amber badge with Select/Reject buttons enabled
- **Selected**: Green badge with Select button disabled
- **Rejected**: Red badge with Reject button disabled

### 4. Notifications to Teams
When a team is evaluated:
- Automatic notification sent to team lead
- Includes the action (Selected/Rejected)
- Includes the faculty's reason
- Encouragement message based on outcome

## Code Changes

### Modified Files
1. `src/pages/FacultyDashboard.jsx` - Complete refactor of evaluation UI

### Key Changes in FacultyDashboard.jsx
```javascript
// New state management
const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
const [evaluationAction, setEvaluationAction] = useState(null);
const [evaluationTeam, setEvaluationTeam] = useState(null);
const [evaluationForm, setEvaluationForm] = useState({
    facultyName: '',
    reason: ''
});
const [teamEvaluationHistory, setTeamEvaluationHistory] = useState({});

// New functions
- fetchEvaluationHistory() - Loads all evaluation history
- openEvaluationModal(team, action) - Opens evaluation modal
- closeEvaluationModal() - Closes and resets modal
- handleStatusUpdate(e) - Processes evaluation with validation
```

## Validation Rules

### Faculty Name
- Required field
- Must not be empty or whitespace only
- Pre-filled from user profile if available
- Stored as entered (no transformations)

### Reason
- Required field
- Minimum 10 characters (trimmed)
- Live character counter shows progress
- Visual feedback (red when < 10, green when >= 10)
- Form submission disabled until valid

## Security & Permissions

### RLS Policies
- **View Evaluations**: Anyone authenticated can view (transparency)
- **Insert Evaluations**: Only faculty and admin roles can insert
- Foreign key to profiles ensures user exists
- Foreign key to teams ensures team exists

### Data Integrity
- Evaluation action limited to 'Selected' or 'Rejected'
- Reason length constraint enforced at database level
- Timestamps automatically managed
- Soft deletes via team cascade

## User Experience Flow

### Faculty Workflow
1. Faculty logs into dashboard
2. Views list of teams with current status
3. Clicks "Select" or "Reject" button for a team
4. Modal opens asking for details:
   - Name (pre-filled)
   - Reason (empty, requires input)
5. Faculty enters evaluation reason
6. Clicks "Confirm Selection/Rejection"
7. System validates input
8. Status updates in database
9. Evaluation history saved
10. Notification sent to team lead
11. Modal closes
12. Dashboard refreshes
13. Evaluation appears in history section

### Team Lead Experience
1. Receives notification about evaluation
2. Notification includes:
   - Action taken (Selected/Rejected)
   - Faculty's reason
   - Encouragement message
3. Can view in notification center

## Testing Checklist

### Before Deploying
- [ ] Run migration in Supabase SQL Editor
- [ ] Verify table created: `SELECT * FROM team_evaluation_history LIMIT 1;`
- [ ] Check RLS policies: View in Supabase Dashboard > Authentication > Policies
- [ ] Test faculty login
- [ ] Test team evaluation flow
- [ ] Verify evaluation history displays
- [ ] Test validation (empty name, short reason)
- [ ] Test notification delivery to team leads
- [ ] Check database entries after evaluation

### Production Deployment
1. **Backup Database First**
   ```sql
   -- In Supabase SQL Editor, export current data
   ```

2. **Apply Migration**
   - Use Supabase Dashboard SQL Editor
   - Verify success message

3. **Deploy Frontend**
   ```bash
   # Build and deploy
   npm run build
   # Deploy to your hosting (Vercel, Netlify, etc.)
   ```

4. **Verify in Production**
   - Test with a test team
   - Check evaluation history displays
   - Verify notifications work

## Troubleshooting

### Migration Fails
- **Error**: "relation already exists"
  - Solution: Table already created, safe to continue
  
- **Error**: "permission denied"
  - Solution: Ensure you're connected as postgres or have admin privileges

### Evaluation Not Saving
- Check browser console for errors
- Verify user has faculty or admin role
- Check RLS policies are active
- Ensure Supabase client is authenticated

### History Not Displaying
- Verify `fetchEvaluationHistory()` is called after data load
- Check browser console for errors
- Ensure team has evaluation history in database:
  ```sql
  SELECT * FROM team_evaluation_history WHERE team_id = 'team-uuid';
  ```

### Modal Not Opening
- Check browser console for JavaScript errors
- Verify `openEvaluationModal` function exists
- Check button onClick handlers

## Rollback Plan

If you need to revert changes:

### 1. Database Rollback
```sql
-- Drop the evaluation history table
DROP TABLE IF EXISTS team_evaluation_history CASCADE;
```

### 2. Code Rollback
```bash
# Revert to previous commit
git log --oneline  # Find commit before changes
git revert <commit-hash>
# Or restore from backup
```

## Maintenance

### Regular Checks
- Monitor table size: `SELECT pg_size_pretty(pg_total_relation_size('team_evaluation_history'));`
- Check for orphaned records (teams/users deleted)
- Review evaluation patterns

### Data Retention
Consider implementing archive strategy:
```sql
-- Archive old evaluations (older than 1 year)
CREATE TABLE team_evaluation_history_archive AS
SELECT * FROM team_evaluation_history 
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM team_evaluation_history 
WHERE created_at < NOW() - INTERVAL '1 year';
```

## Support

For issues or questions:
1. Check error logs in browser console
2. Check Supabase logs in dashboard
3. Review this guide's troubleshooting section
4. Check the git commit history for detailed changes

## Summary

This feature provides:
✅ Full transparency in team evaluation process
✅ Accountability with faculty names recorded
✅ Detailed reasons for every decision
✅ Complete audit trail
✅ Better communication to team leads
✅ Professional, intuitive UI
✅ Production-ready with proper validation
✅ Secure with RLS policies
✅ Easy to maintain and extend

The implementation follows best practices for database design, React state management, and user experience.
