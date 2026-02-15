-- ============================================
-- CLEANUP ALL TEAM DATA - Keep Faculty Only
-- ============================================
-- Run this in your Supabase SQL Editor to remove all teams and allow fresh re-registration
-- WARNING: This will permanently delete all team data!

-- ============================================
-- STEP 1: Delete all notifications for teams
-- ============================================
DELETE FROM notifications 
WHERE recipient_type IN ('team', 'lead')
   OR team_id IS NOT NULL
   OR recipient_id::uuid IN (SELECT id FROM profiles WHERE role = 'lead');

-- ============================================
-- STEP 2: Delete all submissions from teams
-- ============================================
DELETE FROM submissions;

-- ============================================
-- STEP 3: Delete all team members
-- ============================================
DELETE FROM members;

-- ============================================
-- STEP 4: Delete all teams
-- ============================================
DELETE FROM teams;

-- ============================================
-- STEP 5: Delete all lead profiles (keep faculty and admin)
-- ============================================
DELETE FROM profiles 
WHERE role = 'lead';

-- ============================================
-- STEP 6: Delete auth.users for leads (keep faculty and admin)
-- ============================================
-- This will also trigger cascade deletes
DELETE FROM auth.users 
WHERE id NOT IN (
  SELECT id FROM profiles WHERE role IN ('faculty', 'admin')
);

-- ============================================
-- STEP 7: Verify cleanup
-- ============================================
-- Run this to verify all team data is removed:
SELECT 
  'Cleanup Complete!' as status,
  (SELECT COUNT(*) FROM teams) as teams_remaining,
  (SELECT COUNT(*) FROM members) as members_remaining,
  (SELECT COUNT(*) FROM submissions) as submissions_remaining,
  (SELECT COUNT(*) FROM profiles WHERE role = 'lead') as lead_profiles_remaining,
  (SELECT COUNT(*) FROM profiles WHERE role IN ('faculty', 'admin')) as faculty_admin_count,
  (SELECT COUNT(*) FROM notifications WHERE team_id IS NOT NULL OR recipient_type = 'team') as team_notifications_remaining;

-- ============================================
-- EXPECTED RESULTS:
-- All counts should be 0 except faculty_admin_count
-- ============================================
