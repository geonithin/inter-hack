-- ============================================================================
-- QUICK FACULTY ROLE CHECK
-- ============================================================================
-- Run this in Supabase SQL Editor to see your current role
-- Replace 'faculty@gmail.com' with your email
-- ============================================================================

-- Check current user's auth and profile status
SELECT 
  'Your Auth User:' as info,
  u.id as user_id,
  u.email,
  u.created_at as auth_created,
  p.role as profile_role,
  p.full_name,
  p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'faculty@gmail.com'  -- CHANGE THIS TO YOUR EMAIL
LIMIT 1;

-- Check if email exists in faculty table
SELECT 
  'Faculty Record:' as info,
  f.id,
  f.faculty_id,
  f.name,
  f.email,
  f.department,
  f.is_active
FROM faculty f
WHERE f.email = 'faculty@gmail.com'  -- CHANGE THIS TO YOUR EMAIL
LIMIT 1;

-- ============================================================================
-- If profile_role is NULL or not 'faculty', run this FIX:
-- ============================================================================

DO $$
DECLARE
  v_email text := 'faculty@gmail.com';  -- CHANGE THIS TO YOUR EMAIL
  v_user_id uuid;
  v_faculty_name text;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users record found for email: %. You need to create a Supabase Auth account first by logging in.', v_email;
  END IF;
  
  -- Get faculty name if exists
  SELECT name INTO v_faculty_name
  FROM faculty
  WHERE email = v_email
  LIMIT 1;
  
  -- Update or create profile with faculty role
  INSERT INTO profiles (id, email, role, full_name, created_at, updated_at)
  VALUES (
    v_user_id,
    v_email,
    'faculty',
    COALESCE(v_faculty_name, v_email),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'faculty',
    email = v_email,
    full_name = COALESCE(profiles.full_name, v_faculty_name, v_email),
    updated_at = NOW();
  
  RAISE NOTICE '✅ SUCCESS: Profile updated for % with faculty role', v_email;
  RAISE NOTICE 'Try logging in again now!';
END $$;

-- After running the fix, verify it worked:
SELECT 
  '✅ Verification:' as info,
  u.email,
  p.role as profile_role,
  p.full_name,
  CASE 
    WHEN p.role = 'faculty' THEN '✅ CORRECT - You can now login as faculty'
    WHEN p.role IS NULL THEN '❌ FAILED - Profile not created'
    ELSE '⚠️ WARNING - Role is ' || p.role || ' but should be faculty'
  END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'faculty@gmail.com';  -- CHANGE THIS TO YOUR EMAIL
