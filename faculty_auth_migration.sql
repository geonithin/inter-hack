-- ============================================================================
-- FACULTY TO SUPABASE AUTH MIGRATION
-- ============================================================================
-- This script migrates faculty users to Supabase Auth for production-ready
-- authentication while maintaining the faculty table for additional data.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add auth_user_id to faculty table
-- ============================================================================

-- Add column to link faculty records to Supabase Auth users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'faculty' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE faculty ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_faculty_auth_user_id ON faculty(auth_user_id);

-- ============================================================================
-- STEP 2: Remove password from faculty table (will use Supabase Auth)
-- ============================================================================

-- IMPORTANT: Run this ONLY after all faculty users have been migrated to Supabase Auth
-- For now, we'll keep the password column as a backup
-- Uncomment these lines once migration is complete:
-- ALTER TABLE faculty DROP COLUMN IF EXISTS password;

-- ============================================================================
-- STEP 3: Create function to auto-create profile when faculty signs up
-- ============================================================================

-- This trigger function ensures a profile is created with role='faculty'
-- whenever a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_faculty_signup()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  faculty_record RECORD;
BEGIN
  -- Check if this user is a faculty member by email
  SELECT * INTO faculty_record
  FROM public.faculty
  WHERE email = NEW.email
  AND is_active = true;
  
  IF FOUND THEN
    -- Create profile with faculty role
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', faculty_record.name),
      'faculty'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      role = 'faculty',
      full_name = COALESCE(EXCLUDED.full_name, faculty_record.name);
    
    -- Link faculty record to auth user
    UPDATE public.faculty
    SET auth_user_id = NEW.id
    WHERE id = faculty_record.id;
  ELSE
    -- Regular user (student/lead) - create profile with lead role
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'lead'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_faculty_signup for user %: % %', NEW.email, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 4: Create trigger on auth.users
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_faculty ON auth.users;

-- Create trigger that fires when a new user is created in auth.users
CREATE TRIGGER on_auth_user_created_faculty
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_faculty_signup();

-- ============================================================================
-- STEP 5: Grant necessary permissions
-- ============================================================================

-- Allow the function to be executed during signup
GRANT EXECUTE ON FUNCTION public.handle_faculty_signup() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_faculty_signup() TO service_role;

-- ============================================================================
-- STEP 6: Manual migration helper queries
-- ============================================================================

-- Query to check existing faculty without Supabase Auth accounts
SELECT 
  faculty_id,
  name,
  email,
  department,
  auth_user_id,
  CASE 
    WHEN auth_user_id IS NULL THEN '❌ Not migrated'
    ELSE '✅ Migrated'
  END as migration_status
FROM public.faculty
WHERE is_active = true
ORDER BY faculty_id;

-- ============================================================================
-- STEP 7: Verification queries
-- ============================================================================

-- Verify trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created_faculty';

-- Check faculty with profiles
SELECT 
  f.faculty_id,
  f.name,
  f.email,
  f.auth_user_id,
  p.role,
  CASE 
    WHEN p.role = 'faculty' THEN '✅ Correct role'
    WHEN p.role IS NULL THEN '❌ No profile'
    ELSE '⚠️ Wrong role: ' || p.role
  END as status
FROM public.faculty f
LEFT JOIN public.profiles p ON f.auth_user_id = p.id
WHERE f.is_active = true
ORDER BY f.faculty_id;

COMMIT;

-- ============================================================================
-- POST-MIGRATION INSTRUCTIONS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Faculty migration schema has been set up successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '=== IMPORTANT: MANUAL STEPS REQUIRED ===';
  RAISE NOTICE '';
  RAISE NOTICE '1. CREATE SUPABASE AUTH ACCOUNTS FOR FACULTY:';
  RAISE NOTICE '   For each faculty member, they need to sign up via:';
  RAISE NOTICE '   - Supabase Dashboard → Authentication → Users → Invite User';
  RAISE NOTICE '   - OR use the faculty registration feature in the app';
  RAISE NOTICE '   - Use their faculty email address';
  RAISE NOTICE '';
  RAISE NOTICE '2. VERIFY MIGRATION:';
  RAISE NOTICE '   Run the verification queries in STEP 7 to check status';
  RAISE NOTICE '';
  RAISE NOTICE '3. UPDATE APPLICATION CODE:';
  RAISE NOTICE '   - Faculty login should now use Supabase Auth (signInWithPassword)';
  RAISE NOTICE '   - Keep faculty table for additional faculty-specific data';
  RAISE NOTICE '   - Link is automatic via trigger when faculty signs up';
  RAISE NOTICE '';
  RAISE NOTICE '4. REMOVE OLD PASSWORD COLUMN (Optional):';
  RAISE NOTICE '   After all faculty have migrated, uncomment the DROP COLUMN';
  RAISE NOTICE '   statement in STEP 2 to remove the old password column';
  RAISE NOTICE '';
  RAISE NOTICE '=== SECURITY BENEFITS ===';
  RAISE NOTICE '✓ Proper authentication with Supabase Auth';
  RAISE NOTICE '✓ Password hashing and security handled by Supabase';
  RAISE NOTICE '✓ RLS policies work correctly with auth.uid()';
  RAISE NOTICE '✓ Session management and JWT tokens';
  RAISE NOTICE '✓ Password reset and email verification';
END $$;
