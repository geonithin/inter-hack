# 🐛 DEBUGGING FACULTY ACCESS ISSUE

## Current Issue:
- ✅ Faculty login succeeds (authentication works)
- ❌ Gets redirected to "Access Denied" page
- ✅ Home page shows you're logged in

**This means**: Your Supabase Auth is working, but your profile role is not set to 'faculty'

---

## 🔍 STEP 1: Check Browser Console

1. Open browser DevTools (Press **F12**)
2. Go to **Console** tab
3. Try logging in as faculty
4. Look for these logs:

### ✅ Good Login Logs (Should See):
```
🎓 Starting faculty login for: faculty@gmail.com
✅ Auth successful, checking profile...
✅ Faculty role verified: faculty
✅ Faculty login complete!
```

### ❌ Bad Login Logs (Problem):
```
🎓 Starting faculty login for: faculty@gmail.com
✅ Auth successful, checking profile...
⚠️ No profile found, checking faculty table...
❌ Not found in faculty table
```
OR
```
✅ Auth successful, checking profile...
❌ User has wrong role: lead
```

### 🔍 After redirect to /unauthorized:
Look for logs like:
```
ProtectedRoute role check: {
  requiredRole: "faculty",
  userRole: "lead",  ← THIS IS THE PROBLEM
  hasAccess: false
}
```

The `userRole` shows what your account thinks you are. It should be "faculty" but it's probably "lead" or something else.

---

## 🔧 STEP 2: Fix Your Role in Database

### Option A: Run Quick Fix Script

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open [FIX_FACULTY_ROLE.sql](FIX_FACULTY_ROLE.sql)
3. **Change line 61** from `'faculty@gmail.com'` to **YOUR EMAIL**
4. Look for this pattern in the file (appears 4 times):
   ```sql
   WHERE u.email = 'faculty@gmail.com'  -- CHANGE THIS TO YOUR EMAIL
   ```
5. Run the script
6. Should see: `✅ SUCCESS: Profile updated for your@email.com with faculty role`

### Option B: Manual Database Check

Run this query in Supabase SQL Editor (replace email):
```sql
-- Check your current role
SELECT 
  u.email,
  p.role as current_role,
  CASE 
    WHEN p.role = 'faculty' THEN '✅ Correct'
    WHEN p.role IS NULL THEN '❌ No profile exists'
    ELSE '❌ Wrong role: ' || p.role
  END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'faculty@gmail.com';  -- YOUR EMAIL HERE
```

If it shows wrong role or NULL, run this fix:
```sql
-- Fix it
UPDATE profiles
SET role = 'faculty', updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'faculty@gmail.com');
```

---

## 🎯 STEP 3: Test Again

1. **Clear browser cache** (Ctrl+Shift+Del)
2. **Clear localStorage**:
   - Open DevTools (F12)
   - Go to **Application** tab
   - Click **Local Storage** → your site
   - Right-click → **Clear**
3. **Refresh page** (Ctrl+R)
4. **Login again as faculty**
5. Watch console for the emoji logs (`🎓`, `✅`, `❌`)
6. Should redirect to Faculty Dashboard, NOT unauthorized page

---

## 📊 What the Unauthorized Page Shows

The access denied page now displays:
- **Required**: faculty access  
- **Your role**: *shows what role you actually have*

If it says:
- `Your role: lead` → Your profile has wrong role (run fix script)
- `Your role: Not loaded yet` → Profile not loading (check database connection)
- `Your role: null` → No profile exists (run fix script)

---

## 🔴 Common Issues & Solutions

### Issue 1: "Your role: lead" but you want faculty
**Cause**: Profile was created with wrong role  
**Fix**: Run [FIX_FACULTY_ROLE.sql](FIX_FACULTY_ROLE.sql)

### Issue 2: "Not found in faculty table"  
**Cause**: Your email not in `faculty` table  
**Fix**: Add your email to faculty table:
```sql
INSERT INTO faculty (faculty_id, name, email, department, is_active)
VALUES ('FAC001', 'Your Name', 'your@email.com', 'CS', true);
```

### Issue 3: Console shows errors fetching profile
**Cause**: RLS policies blocking access  
**Fix**: Check RLS policies on profiles table

### Issue 4: Role changes but still denied
**Cause**: Browser cached old role  
**Fix**: 
1. Clear localStorage (DevTools → Application → Local Storage → Clear)
2. Hard refresh (Ctrl+Shift+R)
3. Log out and log in again

---

## 📝 Still Having Issues?

1. Open browser console (F12)
2. Try logging in
3. Copy ALL the console logs (right-click → Save as...)
4. Copy the text from the "Access Denied" page showing your role
5. Share both with me

---

## ✅ After Everything Works

Once faculty login works, you still need to run:
- [CLEAN_NOTIFICATION_SETUP.sql](CLEAN_NOTIFICATION_SETUP.sql) - For notification system

---

