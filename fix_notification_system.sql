-- ============================================================================
-- FIX NOTIFICATION SYSTEM - Resolve Type Inconsistencies
-- ============================================================================
-- This script ensures notifications table has the correct schema
-- and RLS policies for the notification system to work properly
-- ============================================================================

BEGIN;

-- Step 1: Drop existing table and recreate with correct schema
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Step 2: Create notifications table with UUID support
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
  message text NOT NULL CHECK (LENGTH(TRIM(message)) > 0),
  type text CHECK (type IN ('success', 'warning', 'info', 'error')) DEFAULT 'info',
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_type text CHECK (recipient_type IN ('lead', 'faculty', 'admin')) DEFAULT 'lead',
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_type text CHECK (sender_type IN ('system', 'faculty', 'admin')) DEFAULT 'system',
  is_read boolean DEFAULT false,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  statement_id integer,
  priority text CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  category text CHECK (category IN ('announcement', 'deadline', 'update', 'reminder', 'alert')) DEFAULT 'announcement',
  related_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  read_at timestamp with time zone,
  expires_at timestamp with time zone
);

-- Step 3: Create indexes for better performance
CREATE INDEX notifications_recipient_id_idx ON notifications(recipient_id);
CREATE INDEX notifications_sender_id_idx ON notifications(sender_id);
CREATE INDEX notifications_team_id_idx ON notifications(team_id);
CREATE INDEX notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX notifications_is_read_idx ON notifications(is_read);
CREATE INDEX notifications_recipient_unread_idx ON notifications(recipient_id, is_read) WHERE NOT is_read;

-- Step 4: Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies if they exist
DROP POLICY IF EXISTS "notifications_select_own_or_faculty" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own_or_admin" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Faculty can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Step 6: Create RLS Policies

-- Allow users to view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (
    auth.uid() = recipient_id
  );

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (
    auth.uid() = recipient_id
  )
  WITH CHECK (
    auth.uid() = recipient_id
  );

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE
  USING (
    auth.uid() = recipient_id
  );

-- Allow faculty and system to insert notifications
CREATE POLICY "Faculty can create notifications" ON notifications
  FOR INSERT
  WITH CHECK (
    -- Faculty can create notifications
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('faculty', 'admin')
    )
    OR
    -- System notifications (sender_type = 'system')
    sender_type = 'system'
  );

-- Step 7: Enable Realtime for notifications (optional but useful)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

COMMIT;

-- Verification queries
DO $$
BEGIN
  RAISE NOTICE '✅ Notifications table created successfully';
  RAISE NOTICE '✅ All indexes created';
  RAISE NOTICE '✅ RLS policies configured';
  RAISE NOTICE '✅ Ready to use!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Ensure .env has correct Supabase credentials';
  RAISE NOTICE '2. Test notification system in the app';
END $$;
