-- ============================================================================
-- IMMEDIATE FIX: Allow User Creation in Supabase Dashboard
-- ============================================================================
-- Run this script if you're getting "Database error creating new user" 
-- when trying to create users in Supabase Dashboard
-- ============================================================================

BEGIN;

-- ============================================================================
-- OPTION 1: Temporarily disable the trigger (RECOMMENDED)
-- ============================================================================
-- This allows user creation to succeed without the trigger interfering

-- Disable the trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created_faculty ON auth.users;

-- You can now create users in Supabase Dashboard without errors
-- After creating the user, run the commands in STEP 2 below

-- ============================================================================
-- STEP 2: Manually create profile for the faculty user
-- ============================================================================
-- Replace the values below with the actual faculty information

-- First, get the user ID that was just created:
-- SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Example: Create profile for faculty@gmail.com
-- Replace 'YOUR_USER_ID_HERE' with the actual UUID from above query
/*
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,  -- Replace with actual user ID
  'faculty@gmail.com',         -- Replace with actual email
  'Faculty Name',              -- Replace with actual name
  'faculty'
)
ON CONFLICT (id) DO UPDATE
SET 
  role = 'faculty',
  full_name = EXCLUDED.full_name;
*/

-- ============================================================================
-- OPTION 2: Re-enable the trigger after fixing it
-- ============================================================================
-- Once faculty_auth_migration.sql is fixed and run, re-enable the trigger:

/*
CREATE TRIGGER on_auth_user_created_faculty
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_faculty_signup();
*/

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if trigger is disabled
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created_faculty';

-- If no rows returned, trigger is disabled ✓

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger disabled - you can now create users in Supabase Dashboard';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '1. Go to Supabase Dashboard → Authentication → Users';
  RAISE NOTICE '2. Click "Create user" and fill in the details';
  RAISE NOTICE '3. User creation should now succeed';
  RAISE NOTICE '';
  RAISE NOTICE '4. After creating the user, run this query to get their ID:';
  RAISE NOTICE '   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;';
  RAISE NOTICE '';
  RAISE NOTICE '5. Manually create their profile using the INSERT command above';
  RAISE NOTICE '   (uncomment and replace YOUR_USER_ID_HERE with actual UUID)';
  RAISE NOTICE '';
  RAISE NOTICE '6. Once faculty_auth_migration.sql is fixed, re-run it to setup the trigger properly';
END $$;
