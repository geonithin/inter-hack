# 🚀 Submissions System Setup Guide

The submissions system requires the database table to be created. Follow these steps to get it working:

## 1. Run the Database Migration

1. **Open your Supabase project dashboard**
   - Go to https://supabase.com/dashboard
   - Navigate to your project: `wcifikknxyotoitwksyw`

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and paste the migration SQL**
   - Open `supabase/migrations/20260210_fix_submissions_table.sql`
   - Copy ALL the contents
   - Paste into the SQL editor
   - Click "RUN" button

## 2. Verify the Setup

After running the migration, you should see:
- A new `submissions` table created
- Sample test data inserted for existing teams
- Proper RLS policies configured

## 3. Test the System

1. **Login as a team lead** and try to submit an idea
2. **Login as faculty** and check the team details page
3. **Check browser console** for any error messages

## 🔧 Troubleshooting

### Error: "relation 'submissions' does not exist"
- **Solution**: Run the migration SQL in Supabase SQL editor

### Error: "new row violates row-level security policy"
- **Solution**: Make sure your user profile has the correct role (team lead, faculty, or admin)

### Submissions not showing in Team Details
- **Open browser console** and check for errors
- **Verify your user role** (faculty/admin can see all submissions)

### No test data showing
- Make sure you have teams in your `teams` table first
- The migration creates sample submissions for existing teams

## 📊 Expected Result

After setup, you should see:
- ✅ Team Details page shows submission data when it exists
- ✅ Dashboard properly detects submitted ideas
- ✅ Faculty can view all team submissions
- ✅ Team leads can only see their own submissions

Run the migration now to fix the empty submissions issue!