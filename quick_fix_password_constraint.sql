-- ============================================================================
-- QUICK FIX: Make Password Nullable and Add Faculty
-- ============================================================================
-- Run this FIRST to fix the immediate error, then run complete_production_setup.sql
-- ============================================================================

BEGIN;

-- Step 1: Make password column nullable
ALTER TABLE public.faculty ALTER COLUMN password DROP NOT NULL;

-- Step 2: Add designation column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'faculty' AND column_name = 'designation'
  ) THEN
    ALTER TABLE public.faculty ADD COLUMN designation text DEFAULT 'Faculty';
  END IF;
END $$;

-- Step 3: Insert faculty@gmail.com
-- Note: department must match check constraint (CS, EC, ME, CE, EE)
INSERT INTO public.faculty (faculty_id, name, email, department, designation, is_active)
VALUES 
  ('FAC001', 'Faculty User', 'faculty@gmail.com', 'CS', 'Faculty', true)
ON CONFLICT (faculty_id) DO UPDATE
SET 
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  is_active = EXCLUDED.is_active;

-- Step 4: Verify faculty was added
SELECT 
  faculty_id,
  name,
  email,
  department,
  is_active,
  auth_user_id
FROM public.faculty
WHERE email = 'faculty@gmail.com';

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Quick fix applied successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What was done:';
  RAISE NOTICE '  ✓ Made password column nullable';
  RAISE NOTICE '  ✓ Added faculty@gmail.com to database';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '';
  RAISE NOTICE '1. NOW RUN: complete_production_setup.sql';
  RAISE NOTICE '   This will set up all authentication and RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE '2. CREATE AUTH ACCOUNT FOR FACULTY:';
  RAISE NOTICE '   → Supabase Dashboard → Authentication → Users → Add User';
  RAISE NOTICE '   → Email: faculty@gmail.com';
  RAISE NOTICE '   → Password: (set a secure password)';
  RAISE NOTICE '   → Check "Auto Confirm User"';
  RAISE NOTICE '   → Click "Create user"';
  RAISE NOTICE '';
  RAISE NOTICE '3. TEST LOGIN:';
  RAISE NOTICE '   → Login with faculty@gmail.com and the password you set';
  RAISE NOTICE '   → Should work immediately!';
  RAISE NOTICE '';
END $$;
