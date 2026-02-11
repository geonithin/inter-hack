-- Emergency Database Recovery Script
-- Use this script ONLY if the main optimization migration causes issues
-- This provides fallback RLS policies and basic fixes

BEGIN;

-- =============================================
-- EMERGENCY RLS POLICY RESET
-- =============================================

-- If RLS policies are completely broken, use these minimal working policies

-- Disable RLS temporarily if needed (EMERGENCY ONLY)
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE members DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (clean slate)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Re-enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;  
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Create MINIMAL working policies (very permissive for recovery)

-- PROFILES - Allow all authenticated users
CREATE POLICY "emergency_profiles_all" ON profiles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- TEAMS - Allow all authenticated users  
CREATE POLICY "emergency_teams_all" ON teams FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- MEMBERS - Allow all authenticated users
CREATE POLICY "emergency_members_all" ON members FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- SUBMISSIONS - Critical fix for the original 403 error
CREATE POLICY "emergency_submissions_select" ON submissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "emergency_submissions_insert" ON submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "emergency_submissions_update" ON submissions FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- PROBLEM STATEMENTS (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'problem_statements') THEN
        ALTER TABLE problem_statements ENABLE ROW LEVEL SECURITY;
        EXECUTE 'CREATE POLICY "emergency_problem_statements_all" ON problem_statements FOR ALL USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- NOTIFICATIONS (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
        EXECUTE 'CREATE POLICY "emergency_notifications_all" ON notifications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)';
    END IF;
END $$;

-- =============================================
-- EMERGENCY TABLE FIXES
-- =============================================

-- Fix missing columns in submissions table if needed
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure submissions table has proper constraints
DO $$
BEGIN
    -- Add check constraint for status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'submissions_status_check'
    ) THEN
        ALTER TABLE submissions ADD CONSTRAINT submissions_status_check 
        CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected'));
    END IF;
END $$;

-- Fix teams table constraints
ALTER TABLE teams ALTER COLUMN name SET NOT NULL;
ALTER TABLE teams ADD CONSTRAINT teams_status_check CHECK (status IN ('Pending', 'Selected', 'Rejected')) NOT VALID; -- NOT VALID allows existing data

-- =============================================
-- EMERGENCY DATA FIXES
-- =============================================

-- Fix any NULL values that might cause issues
UPDATE profiles SET role = 'lead' WHERE role IS NULL;
UPDATE teams SET status = 'Pending' WHERE status IS NULL;
UPDATE submissions SET status = 'submitted' WHERE status IS NULL;

-- =============================================
-- EMERGENCY FUNCTION RECOVERY
-- =============================================

-- Recreate the essential new user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'lead')
    ) 
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        email = EXCLUDED.email,
        role = COALESCE(EXCLUDED.role, profiles.role);
    
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Don't fail user creation if profile insertion fails
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMIT;

-- =============================================
-- EMERGENCY VERIFICATION
-- =============================================

-- Test if the basic functionality works
SELECT 
    'Emergency Recovery Status' as test_type,
    'Tables accessible: ' || COUNT(*) as result
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'teams', 'members', 'submissions');

-- Test RLS policies
SELECT 
    tablename,
    COUNT(policyname) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Final status
SELECT 
    '🚨 EMERGENCY RECOVERY COMPLETED' as status,
    '⚠️  TEMPORARY PERMISSIVE POLICIES ACTIVE' as warning,
    '🔧 APPLY PROPER SECURITY POLICIES ASAP' as action_required,
    NOW() as completed_at;