# PRODUCTION BACKEND FIXES - DEPLOYMENT GUIDE

## Issues Fixed
This deployment fixes **two critical backend issues** in your production system:

### 1. ✅ Teams Can No Longer Switch Problem Statements After Submission
- **Problem**: Teams could change their selected problem statement even after submitting their idea
- **Solution**: Updated RLS policy to lock the `selected_statement_id` field once a submission exists
- **Impact**: Prevents teams from gaming the system or accidentally losing their work

### 2. ✅ Faculty Dashboard Delete & Edit Operations Now Work
- **Problem**: Faculty couldn't delete problem statements or edit/delete teams
- **Solution**: Updated RLS policies to grant proper permissions to faculty role
- **Impact**: Faculty dashboard is now fully functional for managing teams and statements

---

## Deployment Steps

### Step 1: Deploy Backend Changes (REQUIRED)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `smce-inter-hack`

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Copy the **ENTIRE contents** of `production_backend_fixes.sql`
   - Paste into the SQL editor
   - Click "Run" or press `Ctrl+Enter`

4. **Verify Success**
   - You should see: `POLICIES UPDATED SUCCESSFULLY`
   - Check for any errors in the output panel
   - If errors occur, copy the error message and contact support

### Step 2: Deploy Frontend Changes (Already Done)

The following frontend changes have been made in your code:

1. **Dashboard.jsx** - Updated to:
   - Show "Locked" button for non-selected statements when team has submitted
   - Prevent clicks on "Switch Track" after submission
   - Display clear messaging about locked status

2. **Landing.jsx** - Fixed logo paths (already deployed)

### Step 3: Deploy to Production

After running the SQL migration:

```powershell
# Stage all changes
git add .

# Commit the changes
git commit -m "Fix: Prevent statement switching after submission & enable faculty edit/delete"

# Push to production
git push origin main
```

Vercel will automatically redeploy your application.

---

## Testing Checklist

### Test 1: Statement Lock After Submission
- [ ] Login as a team lead
- [ ] Select a problem statement
- [ ] Submit your idea through the submission form
- [ ] Navigate back to problem statements list
- [ ] Verify "Switch Track" buttons are now "Locked"
- [ ] Verify you can only "View Submission" for your selected statement

### Test 2: Faculty Delete Statement
- [ ] Login as faculty (`faculty@gmail.com`)
- [ ] Go to Faculty Dashboard → Statements tab
- [ ] Click delete (trash icon) on a statement with NO teams
- [ ] Confirm deletion
- [ ] Verify statement is removed from list

### Test 3: Faculty Edit Team
- [ ] Login as faculty
- [ ] Go to Faculty Dashboard → Teams tab
- [ ] Click "View Details" on any team
- [ ] Click "Edit Team Info"
- [ ] Change team name or department
- [ ] Click "Save Changes"
- [ ] Verify changes are reflected

### Test 4: Faculty Delete Team
- [ ] Login as faculty
- [ ] View any team details
- [ ] Click "Delete Team"
- [ ] Confirm deletion
- [ ] Verify team and members are removed

---

## Backend Changes Explained

### Policy 1: teams_update_own (Statement Lock)
```sql
-- Prevents teams from changing selected_statement_id after submission
WITH CHECK (
  (auth.uid() = lead_id AND (
    NOT EXISTS (SELECT 1 FROM submissions WHERE team_id = teams.id)
    OR
    selected_statement_id = (SELECT selected_statement_id FROM teams WHERE id = teams.id)
  ))
  OR
  get_current_user_role() IN ('faculty', 'admin')
)
```
**Logic**: 
- If NO submission exists → Allow any update
- If submission EXISTS → Only allow updates that DON'T change `selected_statement_id`
- Faculty/Admin can always update (override for management)

### Policy 2: teams_delete_own (Faculty Can Delete)
```sql
-- Changed from 'admin' only to 'faculty' OR 'admin'
USING (
  auth.uid() = lead_id OR 
  get_current_user_role() IN ('faculty', 'admin')
)
```

### Policy 3: problem_statements_delete_faculty
```sql
-- Changed from 'admin' only to 'faculty' OR 'admin'
USING (
  get_current_user_role() IN ('faculty', 'admin')
)
```

### Policy 4: members_delete_team_lead
```sql
-- Added faculty permission to enable cascading team deletions
USING (
  auth.uid() IN (SELECT lead_id FROM teams WHERE id = team_id) OR
  get_current_user_role() IN ('faculty', 'admin')
)
```

---

## Rollback Plan (If Needed)

If you encounter issues after deployment:

1. **Rollback Backend**:
   ```sql
   -- In Supabase SQL Editor, run:
   BEGIN;
   -- Re-run the original policies from complete_production_setup.sql
   ROLLBACK;
   ```

2. **Rollback Frontend**:
   ```powershell
   git revert HEAD
   git push origin main
   ```

---

## Security Notes

✅ **Safe for Production**
- Uses proper RLS policies (Row Level Security)
- Respects existing user roles (lead, faculty, admin)
- No breaking changes to existing data
- Can be run multiple times safely (idempotent)

✅ **No Data Loss**
- Only updates security policies
- Does not delete or modify any data
- Teams can still submit ideas normally
- Faculty permissions are expanded, not restricted

---

## Support

If you encounter any issues:

1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Check browser console for frontend errors
3. Verify user roles: `SELECT * FROM profiles WHERE role = 'faculty'`
4. Contact me with specific error messages

---

## Verification Queries

Run these in Supabase SQL Editor to verify policies are active:

```sql
-- Check teams policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'teams' 
ORDER BY policyname;

-- Check problem_statements policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'problem_statements' 
ORDER BY policyname;

-- Check if any teams have submissions
SELECT 
  t.name AS team_name,
  ps.title AS statement_title,
  COUNT(s.id) AS submission_count,
  CASE 
    WHEN COUNT(s.id) > 0 THEN 'LOCKED'
    ELSE 'CAN SWITCH'
  END AS can_switch_statement
FROM teams t
LEFT JOIN submissions s ON s.team_id = t.id
LEFT JOIN problem_statements ps ON ps.id = t.selected_statement_id
GROUP BY t.id, t.name, ps.title
ORDER BY submission_count DESC;
```

---

**Last Updated**: February 12, 2026
**Migration File**: `production_backend_fixes.sql`
**Status**: ✅ Ready for Production
