-- Test script to verify the database fixes
-- Run this in your Supabase SQL editor to apply the profile trigger fixes

DO $$
BEGIN
    -- Test if trigger exists and handle_new_user function works
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        RAISE NOTICE 'Profile creation trigger exists';
    ELSE
        RAISE WARNING 'Profile creation trigger missing - please run the migration';
    END IF;
    
    -- Check if profiles table has proper RLS policies
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can insert their own profile'
    ) THEN
        RAISE NOTICE 'Profile insert policy exists';
    ELSE
        RAISE WARNING 'Profile insert policy missing - please run the migration';
    END IF;
END
$$;

-- Check current profiles table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd, permissive, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';