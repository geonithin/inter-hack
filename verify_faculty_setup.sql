-- ============================================================================
-- VERIFY FACULTY SETUP
-- ============================================================================
-- Run this in Supabase SQL Editor to check your faculty account setup
-- ============================================================================

-- Check if profiles table has faculty users
SELECT 
  'Checking profiles table...' as step,
  COUNT(*) as faculty_count
FROM profiles 
WHERE role = 'faculty';

-- List all faculty profiles
SELECT 
  'Faculty Profiles:' as info,
  id,
  email,
  role,
  full_name,
  created_at
FROM profiles 
WHERE role = 'faculty' OR role = 'admin'
ORDER BY created_at DESC;

-- Check faculty table
SELECT 
  'Faculty Table:' as info,
  id,
  faculty_id,
  name,
  email,
  department,
  is_active,
  created_at
FROM faculty
WHERE is_active = true
ORDER BY created_at DESC;

-- Check for mismatched emails (faculty in faculty table but not in profiles with faculty role)
SELECT 
  'Emails in faculty table but not profiles:' as issue,
  f.email,
  f.name,
  f.department,
  p.role as current_role
FROM faculty f
LEFT JOIN profiles p ON f.email = p.email
WHERE f.is_active = true
  AND (p.role IS NULL OR p.role NOT IN ('faculty', 'admin'));

-- FIX SCRIPT: If you see an email above, run this to fix it
-- (Replace 'faculty@gmail.com' with your faculty email)
/*
DO $$
DECLARE
  v_faculty_email text := 'faculty@gmail.com';  -- CHANGE THIS TO YOUR EMAIL
  v_user_id uuid;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_faculty_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth user found with email: %', v_faculty_email;
    RAISE NOTICE 'Please create a Supabase Auth account first by logging in or registering';
  ELSE
    -- Update the profile to have faculty role
    INSERT INTO profiles (id, email, role, full_name)
    VALUES (
      v_user_id,
      v_faculty_email,
      'faculty',
      (SELECT name FROM faculty WHERE email = v_faculty_email LIMIT 1)
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'faculty',
        email = v_faculty_email,
        full_name = COALESCE(profiles.full_name, (SELECT name FROM faculty WHERE email = v_faculty_email LIMIT 1));
    
    RAISE NOTICE 'Profile updated for % with faculty role', v_faculty_email;
  END IF;
END $$;
*/

-- Check auth.users for faculty emails
SELECT 
  'Auth users matching faculty emails:' as info,
  u.id,
  u.email,
  u.created_at as auth_created_at,
  p.role as profile_role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email IN (SELECT email FROM faculty WHERE is_active = true);
