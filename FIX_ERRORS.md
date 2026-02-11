# Fix Console Errors - Quick Guide

You're seeing two errors in the console. Here's how to fix them:

---

## Error 1: Profile Upsert (400 Bad Request)
**Status:** ✅ FIXED in code
**What happened:** Faculty login was trying to create/update user profiles incorrectly
**Fix applied:** Updated AuthContext.jsx to handle profile creation properly

---

## Error 2: Problem Statements RLS Policy (401 Unauthorized)
**Status:** ⚠️ REQUIRES SQL SCRIPT

### The Problem:
Faculty users cannot add problem statements because of Row Level Security (RLS) policies.

### The Solution:
Run the SQL fix script in Supabase.

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Run the Fix Script**
   - Open the file: `quick_fix_rls.sql` in this project
   - Copy ALL the content
   - Paste it into the SQL Editor
   - Click "Run" (or press Ctrl/Cmd + Enter)

4. **Verify Success**
   - You should see a message showing `rowsecurity = false`
   - This means RLS has been disabled for development

5. **Test**
   - Go back to Faculty Dashboard
   - Try adding a problem statement again
   - It should work now! ✅

---

## What Changed?

### Code Fixes Applied:
- ✅ Fixed profile upsert in [AuthContext.jsx](src/contexts/AuthContext.jsx)
- ✅ Improved error messages in [FacultyDashboard.jsx](src/pages/FacultyDashboard.jsx)
- ✅ Better error handling to guide users to the fix

### Database Fix Required:
- ⚠️ Run [quick_fix_rls.sql](quick_fix_rls.sql) in Supabase SQL Editor

---

## Quick Reference

**File to run:** `quick_fix_rls.sql`
**Where to run:** Supabase Dashboard → SQL Editor
**What it does:** Disables RLS on problem_statements table for development

---

## Alternative Solutions

If you prefer to keep RLS enabled but with permissive policies, edit `quick_fix_rls.sql` and:
1. Comment out the `DISABLE ROW LEVEL SECURITY` line
2. Uncomment the `CREATE POLICY` line for Option 2

---

## Need Help?

If you still see errors after running the script:
1. Check the SQL Editor output for any error messages
2. Verify you're connected to the correct Supabase project
3. Make sure you have admin access to the project
4. Try refreshing the Faculty Dashboard page

---

✨ After running the SQL script, all errors should be resolved!
