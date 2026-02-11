# 🎯 Quick Reference: Production Setup

## What You Need to Do (4 Steps)

### 🔧 STEP 0: Fix Password Constraint (If Needed)

**If you get:** `null value in column "password" violates not-null constraint`

**Run this FIRST:** `quick_fix_password_constraint.sql`

Then proceed with step 1 below.

---

### 1️⃣ Run SQL Script (2 min)
**File:** `complete_production_setup.sql`

**Where:** Supabase Dashboard → SQL Editor → New Query

**Action:** Copy entire file → Paste → Run

---

### 2️⃣ Add Faculty to Database (1 min)

**Note:** If you ran `complete_production_setup.sql`, `faculty@gmail.com` is already added!

To add more faculty:
```sql
-- Copy and edit this, then run in SQL Editor
-- Department must be: CS, EC, ME, CE, or EE
INSERT INTO faculty (faculty_id, name, email, department, is_active)
VALUES 
  ('FAC002', 'Dr. Your Name', 'your.email@smce.edu', 'CS', true)
ON CONFLICT (faculty_id) DO NOTHING;
```

To verify existing faculty:
```sql
SELECT faculty_id, name, email FROM faculty WHERE is_active = true;
```

---

### 3️⃣ Create Auth Accounts (2 min each)
**Where:** Supabase Dashboard → Authentication → Users → Add User

**For faculty@gmail.com (already in database):**
- Email: **faculty@gmail.com**
- Password: (set securely, e.g., Faculty@123)
- ✅ Check "Auto Confirm User"
- Click "Create user"

**For additional faculty:**
- Email: (must match faculty table email exactly)
- Password: (set securely)
- ✅ Check "Auto Confirm User"
- Click "Create user"

---

### 4️⃣ Test (3 min)
1. Login as faculty with Supabase Auth credentials
2. Add a problem statement ✅
3. Register a student ✅
4. Form a team ✅
5. Submit an idea ✅

---

## ✅ Success Indicators

**When working correctly:**
- ✅ No 401 errors when adding problem statements
- ✅ No "Database error creating new user"
- ✅ Profile role = 'faculty' for faculty users
- ✅ Profile role = 'lead' for student users
- ✅ Notifications work
- ✅ No RLS policy violations

---

## 🔴 Troubleshooting One-Liners

**Faculty can't add problem statements:**
```sql
-- Check role
SELECT email, role FROM profiles WHERE email = 'faculty@email.com';
-- Fix if needed
UPDATE profiles SET role = 'faculty' WHERE email = 'faculty@email.com';
```

**User creation fails:**
```sql
-- Check faculty exists
SELECT * FROM faculty WHERE email = 'faculty@email.com';
-- Add if missing
INSERT INTO faculty (faculty_id, name, email, department, is_active)
VALUES ('FAC999', 'Name', 'faculty@email.com', 'CS', true);
```

**Check if everything is set up:**
```sql
-- Should show "✅ Ready" for all active faculty
SELECT 
  f.faculty_id,
  f.name,
  f.email,
  CASE 
    WHEN f.auth_user_id IS NOT NULL AND p.role = 'faculty' THEN '✅ Ready'
    WHEN f.auth_user_id IS NULL THEN '❌ No auth'
    ELSE '⚠️ Check role'
  END as status
FROM faculty f
LEFT JOIN profiles p ON f.auth_user_id = p.id
WHERE f.is_active = true;
```

---

## 📚 Full Documentation

- **Setup Guide:** `COMPLETE_PRODUCTION_GUIDE.md`
- **Architecture:** `ARCHITECTURE.md`
- **Main Script:** `complete_production_setup.sql`

---

## 🎉 That's It!

**Total Time:** 15 minutes  
**Difficulty:** Copy-paste easy  
**Result:** Production-ready system with full security

---

## 💡 Key Points

1. **One script does everything** - No multiple steps
2. **Automatic role assignment** - Email-based detection
3. **No temporary fixes** - All production-grade
4. **No legacy code** - Clean implementation
5. **Works immediately** - Test right after setup

---

**Need help?** Check `COMPLETE_PRODUCTION_GUIDE.md` for detailed troubleshooting.
