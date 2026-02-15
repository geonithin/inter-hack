# Complete Cleanup Guide - Remove All Team Data

## Step 1: Database Cleanup

### Run SQL Script
1. Open **Supabase Dashboard** → Your Project → **SQL Editor**
2. Copy **ALL** contents of `CLEANUP_ALL_TEAMS.sql`
3. Paste into SQL Editor
4. Click **"Run"** button
5. Verify the results show:
   - `teams_remaining: 0`
   - `members_remaining: 0`
   - `submissions_remaining: 0`
   - `lead_profiles_remaining: 0`
   - `faculty_admin_count: <number of faculty>` (should be > 0)
   - `team_notifications_remaining: 0`

## Step 2: Clear Application Cache

### Supabase Cache (Server-Side)
The database deletion will automatically clear all server-side cached data.

### Browser Cache (Client-Side)
Users should clear their browser cache:

#### For Chrome/Edge:
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Select "All time"
4. Click "Clear data"

#### Or Force Refresh:
- Press `Ctrl + F5` (Windows)
- Or `Ctrl + Shift + R`

#### For Complete Reset:
1. Open Developer Tools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Supabase Auth Sessions
To clear all active sessions:
1. In Supabase Dashboard → Authentication → Users
2. The deleted users will be automatically signed out

## Step 3: Verify Cleanup

### Check Database:
Run this query in SQL Editor:
```sql
SELECT 
  (SELECT COUNT(*) FROM teams) as teams,
  (SELECT COUNT(*) FROM members) as members,
  (SELECT COUNT(*) FROM profiles WHERE role = 'lead') as leads,
  (SELECT COUNT(*) FROM profiles WHERE role IN ('faculty', 'admin')) as faculty
FROM (SELECT 1) as dummy;
```

Expected results:
- teams: 0
- members: 0
- leads: 0
- faculty: should be your faculty count

### Check Application:
1. Try logging in as faculty → Should work ✅
2. Try logging in with any old team credentials → Should fail ✅
3. Go to registration page → Should allow fresh registration ✅

## Step 4: Test Fresh Registration

After cleanup:
1. Go to the registration page
2. Register a new team with AIDS department
3. Include all member details
4. Submit registration
5. Verify in Faculty Dashboard that team appears correctly

## Important Notes

⚠️ **BACKUP REMINDER**: If you need to keep any team data, export it before running the cleanup!

✅ **What's Preserved**:
- Faculty accounts and data
- Admin accounts and data
- Problem statements
- Database structure and constraints

❌ **What's Deleted**:
- All team registrations
- All team members
- All team submissions
- All team notifications
- All team lead accounts
- All team authentication sessions

## After Cleanup

Teams can now re-register with:
- Proper database constraints (AIDS department supported)
- All lead_* columns present
- Fixed member registration
- Correct notification system
