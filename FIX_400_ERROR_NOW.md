# 🚨 FIX FACULTY 400 ERROR - Quick Guide

## Problem
Faculty trying to add problem statements gets **400 error** in console.

## Root Causes
1. ❌ `problem_statements` table doesn't exist or has wrong structure
2. ❌ RLS policies not configured for faculty
3. ❌ Faculty user not properly authenticated with Supabase Auth
4. ❌ Profile doesn't have correct role

## ✅ Solution (3 Steps, 5 Minutes)

---

### Step 1: Run Database Setup Scripts

**Open:** Supabase Dashboard → SQL Editor

**Run in order:**

1. **First:** Copy and paste all of `quick_fix_password_constraint.sql` → Run
   - This fixes the password constraint issue
   - Adds faculty@gmail.com to database

2. **Second:** Copy and paste all of `fix_faculty_400_error.sql` → Run
   - This creates problem_statements table
   - Sets up all RLS policies
   - Configures automatic role detection

**✅ Expected:** Success messages with checklists

---

### Step 2: Create Supabase Auth Account

**Go to:** Supabase Dashboard → Authentication → Users

**Click:** "Add User" (or "Create new user")

**Fill in:**
- Email: `faculty@gmail.com`
- Password: `Faculty@2026!` (or your own secure password - **REMEMBER THIS**)
- ✅ Check "Auto Confirm User"

**Click:** "Create user"

**✅ Expected:** User created successfully

---

### Step 3: Login to Your App

1. **Go to:** Your app's Faculty Login page
2. **Login with:**
   - Email: `faculty@gmail.com`
   - Password: (the password you just set in Step 2)
3. **✅ First login creates profile automatically**
4. **Try adding a problem statement** → Should work!

---

## 🧪 Verify It Works

### In Supabase SQL Editor, run this:

```sql
-- Check everything is configured correctly
SELECT 
  f.email,
  p.role,
  CASE 
    WHEN p.role = 'faculty' THEN '✅ Can add problem statements'
    ELSE '❌ Wrong role: ' || COALESCE(p.role, 'NULL')
  END as status
FROM faculty f
LEFT JOIN profiles p ON f.auth_user_id = p.id
WHERE f.email = 'faculty@gmail.com';
```

**Expected:** Should show `✅ Can add problem statements`

---

## 🎯 Test Adding Problem Statement

1. **Login as faculty@gmail.com**
2. **Click "Add Problem Statement"**
3. **Fill in:**
   - Title: "Test Problem" (any non-empty text)
   - Description: "This is a detailed test description with more than 21 characters" (minimum 21 characters!)
   - Department: CS
   - Max Teams: 3 (between 1-10)
4. **Click "Add"**

**✅ Expected:** Success message, problem statement appears in list

**⚠️ Important Validation Rules:**
- **Description must be at least 21 characters** (after removing spaces)
- Max teams must be between 1 and 10
- The form will show you character count and validation errors in real-time

---

## ❓ Troubleshooting

### If you still get 400 error:

**Check browser console for the error message:**

1. **"Table does not exist"**
   - Run `fix_faculty_400_error.sql` again

2. **"Permission denied" or "42501"**
   - RLS policies not set up
   - Run `fix_faculty_400_error.sql` again

3. **"JWT" error**
   - Log out and log back in
   - Clear browser cache

4. **"Required field missing"**
   - Check console log for which field
   - Make sure all form fields are filled

---

## 📊 Diagnose Issues

Run this diagnostic script to see what's wrong:

```bash
# In Supabase SQL Editor
Run: diagnose_faculty_error.sql
```

This will show you:
- ✅ What's working
- ❌ What's missing
- 🔧 How to fix it

---

## 🎉 Once Working

Your faculty can:
- ✅ Add problem statements
- ✅ Edit problem statements
- ✅ Delete problem statements
- ✅ View all team submissions

All with proper security (RLS policies prevent unauthorized access).

---

## 💡 Production Notes

**This setup is production-ready:**
- ✅ Proper authentication via Supabase Auth
- ✅ Row Level Security (RLS) policies
- ✅ Automatic role detection
- ✅ No hardcoded passwords
- ✅ Secure JWT tokens
- ✅ Proper error handling in frontend

**To add more faculty:**
1. Insert into faculty table
2. Create Supabase Auth account
3. They login once to link accounts
4. Done!

---

## 📁 Files Created

1. `fix_faculty_400_error.sql` - Main fix script (run this!)
2. `diagnose_faculty_error.sql` - Diagnostic tool
3. Updated `FacultyDashboard.jsx` - Better error messages
4. This guide - `FIX_400_ERROR_NOW.md`

---

## Need Help?

Check the detailed logs in:
- Browser Console (F12 → Console tab)
- Supabase Logs (Dashboard → Logs)
- SQL Editor output

The error messages now tell you exactly what's wrong and how to fix it!
