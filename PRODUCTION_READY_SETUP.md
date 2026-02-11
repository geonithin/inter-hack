# Production-Ready Authentication & Security Setup

This guide provides a complete production-ready approach to fix authentication and Row Level Security (RLS) issues in your hackathon management system.

---

## 🎯 Overview

Your system currently has two authentication methods:
- **Students/Team Leads**: Supabase Auth (production-ready ✅)
- **Faculty**: Custom table authentication (development only ⚠️)

This causes issues because:
- Faculty don't have `auth.uid()` → RLS policies fail
- No proper session management for faculty
- Passwords stored in plain text (security risk)
- Cannot use Supabase's built-in security features

---

## 🏗️ Production-Ready Architecture

### New Approach:
1. **All users** authenticate via Supabase Auth
2. **Faculty table** stores additional faculty-specific data
3. **Profiles table** links everyone with role-based access
4. **RLS policies** use `auth.uid()` and profile roles

### Benefits:
- ✅ Secure password hashing by Supabase
- ✅ Proper session management with JWT tokens
- ✅ RLS policies work correctly
- ✅ Password reset and email verification
- ✅ Multi-factor authentication support
- ✅ Audit logs and security monitoring

---

## 📋 Migration Steps

### Step 1: Database Schema Setup (5 minutes)

Run the migration script in Supabase SQL Editor:

```sql
-- Navigate to: Supabase Dashboard → SQL Editor → New Query
```

**Copy and run:** `faculty_auth_migration.sql`

This will:
- Add `auth_user_id` column to faculty table
- Create trigger to auto-assign faculty role
- Set up helper functions
- Link faculty and auth users

**Verify:**
```sql
-- Check the trigger was created
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created_faculty';
```

---

### Step 2: RLS Policies Setup (5 minutes)

Run the production RLS script:

**Copy and run:** `production_ready_rls_fix.sql`

This will:
- Create role-based RLS policies for all tables
- Add helper function `get_current_user_role()`
- Enable proper access control
- Maintain security while allowing necessary operations

**Verify:**
```sql
-- Check all policies are in place
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

### Step 3: Create Supabase Auth Accounts for Faculty (10-30 minutes)

Each faculty member needs a Supabase Auth account.

#### Option A: Admin Creates Accounts (Recommended)

1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **"Invite User"**
3. Enter faculty email address
4. Check "Auto Confirm" user
5. Send invitation or set password

Repeat for each faculty member.

#### Option B: Faculty Self-Registration

Create a faculty registration page in your app:

```javascript
// Example: Faculty signup
const { data, error } = await supabase.auth.signUp({
  email: 'faculty@smce.edu',
  password: 'secure_password',
  options: {
    data: {
      full_name: 'Dr. Faculty Name'
    }
  }
});

// The trigger automatically links them to the faculty table
// and sets their role to 'faculty' in profiles
```

#### Verification Query:
```sql
-- Check migration status
SELECT 
  faculty_id,
  name,
  email,
  CASE 
    WHEN auth_user_id IS NULL THEN '❌ Not migrated - needs Supabase account'
    ELSE '✅ Migrated'
  END as status
FROM faculty
WHERE is_active = true;
```

---

### Step 4: Update Application Code (Already Done ✅)

The code has been updated to support both:
- **New approach**: Supabase Auth for faculty (production-ready)
- **Legacy approach**: Custom authentication (backwards compatible)

**Key changes in `AuthContext.jsx`:**
```javascript
handleFacultyLogin() {
  // 1. Try Supabase Auth first (production)
  // 2. Fallback to legacy auth (migration period)
  // 3. Show warning for legacy users
}
```

During migration, faculty can still login with their old credentials, but will see:
> ⚠️ Using legacy faculty authentication. Please migrate to Supabase Auth for production.

---

### Step 5: Test the Migration (15 minutes)

#### Test 1: Migrated Faculty Login
1. Create a Supabase Auth account for one faculty member
2. Faculty logs in with email + password
3. ✅ Should succeed with proper `auth.uid()`
4. ✅ Can add problem statements without errors
5. ✅ RLS policies work correctly

#### Test 2: Legacy Faculty Login
1. Faculty member without Supabase Auth account
2. Logs in with faculty ID or email + password
3. ⚠️ Should work but show migration warning
4. ⚠️ May have limited functionality

#### Test 3: Student Login
1. Student creates account via registration
2. Forms team and selects problem statement
3. ✅ Should work as before
4. ✅ Submissions work correctly

---

## 🔒 Security Checklist

### Before Going to Production:

- [ ] All faculty have Supabase Auth accounts
- [ ] `production_ready_rls_fix.sql` executed successfully
- [ ] `faculty_auth_migration.sql` executed successfully
- [ ] Verified all RLS policies are active
- [ ] Tested faculty can add problem statements
- [ ] Tested students can form teams and submit
- [ ] Verified profiles have correct roles
- [ ] Removed or deprecated legacy password column
- [ ] All console errors resolved
- [ ] Mobile UI tested on multiple screen sizes

### Optional Production Enhancements:

- [ ] Enable email verification for new users
- [ ] Set up password complexity requirements
- [ ] Configure JWT expiration times
- [ ] Enable multi-factor authentication
- [ ] Set up rate limiting for auth endpoints
- [ ] Configure email templates (password reset, etc.)
- [ ] Add audit logging for sensitive operations

---

## 🔧 Troubleshooting

### Issue: Faculty cannot add problem statements (401 error)

**Cause:** RLS policies not set up or faculty not using Supabase Auth

**Fix:**
1. Run `production_ready_rls_fix.sql`
2. Ensure faculty has Supabase Auth account
3. Check profile has `role='faculty'`

**Verify:**
```sql
SELECT p.email, p.role, f.faculty_id
FROM profiles p
JOIN faculty f ON p.id = f.auth_user_id
WHERE p.email = 'faculty_email@smce.edu';
```

---

### Issue: Profile upsert fails (400 error)

**Cause:** Profile already exists or RLS policy blocks insert

**Fix:**
1. Check RLS policies on profiles table
2. Ensure user is authenticated
3. Verify `get_current_user_role()` function exists

**Verify:**
```sql
-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'get_current_user_role';

-- Test the function
SELECT get_current_user_role();
```

---

### Issue: Legacy faculty login shows error

**Cause:** Faculty table doesn't have required columns

**Fix:**
```sql
-- Check faculty table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'faculty';

-- Should have: id, faculty_id, name, email, department, 
--              is_active, auth_user_id, password (legacy)
```

---

### Issue: RLS policies too restrictive

**Temporary Development Fix:**
```sql
-- ONLY use in development, NOT production
ALTER TABLE problem_statements DISABLE ROW LEVEL SECURITY;
```

**Production Fix:**
- Review and adjust policies in `production_ready_rls_fix.sql`
- Use `get_current_user_role()` for role checks
- Test with different user types

---

## 📊 Monitoring & Verification

### Check All Users and Roles:
```sql
SELECT 
  p.email,
  p.role,
  CASE 
    WHEN f.faculty_id IS NOT NULL THEN 'Faculty: ' || f.faculty_id
    WHEN t.id IS NOT NULL THEN 'Team Lead: ' || t.team_name
    ELSE 'Student'
  END as user_type,
  p.created_at
FROM profiles p
LEFT JOIN faculty f ON p.id = f.auth_user_id
LEFT JOIN teams t ON p.id = t.lead_id
ORDER BY p.created_at DESC;
```

### Check RLS Policy Coverage:
```sql
SELECT 
  tablename,
  COUNT(*) as policy_count,
  SUM(CASE WHEN cmd = 'SELECT' THEN 1 ELSE 0 END) as select_policies,
  SUM(CASE WHEN cmd = 'INSERT' THEN 1 ELSE 0 END) as insert_policies,
  SUM(CASE WHEN cmd = 'UPDATE' THEN 1 ELSE 0 END) as update_policies,
  SUM(CASE WHEN cmd = 'DELETE' THEN 1 ELSE 0 END) as delete_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

### Test Authentication Flow:
```sql
-- Check recent auth activity
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🎓 Best Practices

### 1. Always Use Supabase Auth
- Never store passwords in application tables
- Use Supabase's built-in security features
- Leverage JWT tokens for session management

### 2. Role-Based Access Control
- Assign roles in profiles table
- Use roles in RLS policies
- Keep roles simple: student, faculty, admin

### 3. Test RLS Policies
- Test with different user types
- Use `SELECT current_user` to debug
- Check policy using expressions carefully

### 4. Monitor and Audit
- Track authentication failures
- Log sensitive operations
- Review user activity regularly

### 5. Security Updates
- Keep Supabase client library updated
- Review security announcements
- Patch vulnerabilities promptly

---

## 📞 Support

If you encounter issues:

1. **Check verification queries** in the SQL scripts
2. **Review console errors** in browser DevTools
3. **Test with simple queries** to isolate the problem
4. **Verify environment variables** (Supabase URL, keys)
5. **Check Supabase Dashboard** for auth logs

---

## ✅ Success Criteria

Your system is production-ready when:

- ✅ All users authenticate via Supabase Auth
- ✅ No console errors (400/401) for normal operations
- ✅ Faculty can add problem statements
- ✅ Students can form teams and submit ideas
- ✅ RLS policies are enabled on all tables
- ✅ Passwords are hashed (never plain text)
- ✅ Sessions expire and refresh properly
- ✅ Mobile UI works on all screen sizes
- ✅ No warnings about legacy authentication

---

**Current Status:**
- ✅ SQL migration scripts created
- ✅ AuthContext.jsx updated with production approach
- ✅ RLS policies designed and ready
- ⚠️ Waiting for database script execution
- ⚠️ Waiting for faculty Supabase Auth account creation

**Next Action:** Run `faculty_auth_migration.sql` and `production_ready_rls_fix.sql` in Supabase SQL Editor.
