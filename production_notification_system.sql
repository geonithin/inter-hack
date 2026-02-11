-- ============================================================================
-- PRODUCTION-READY NOTIFICATION SYSTEM
-- ============================================================================
-- Complete notification system with history, tracking, and proper RLS policies
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: CREATE/UPDATE NOTIFICATIONS TABLE WITH ALL FEATURES
-- ============================================================================

-- Main notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
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
  statement_id integer REFERENCES problem_statements(id) ON DELETE SET NULL,
  priority text CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  category text CHECK (category IN ('announcement', 'deadline', 'update', 'reminder', 'alert')) DEFAULT 'announcement',
  related_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  read_at timestamp with time zone,
  expires_at timestamp with time zone
);

-- Add missing columns if table already exists
DO $$
BEGIN
  -- Drop old policies that might conflict with column changes
  DROP POLICY IF EXISTS "notifications_select_own_or_faculty" ON notifications;
  DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
  DROP POLICY IF EXISTS "notifications_delete_own_or_admin" ON notifications;
  DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
  DROP POLICY IF EXISTS "Faculty can create notifications" ON notifications;

  -- Add priority column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN priority text CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal';
  END IF;

  -- Add category column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'category'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN category text CHECK (category IN ('announcement', 'deadline', 'update', 'reminder', 'alert')) DEFAULT 'announcement';
  END IF;

  -- Add expires_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN expires_at timestamp with time zone;
  END IF;

  -- Add statement_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'statement_id'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN statement_id integer REFERENCES problem_statements(id) ON DELETE SET NULL;
  END IF;

  -- Add sender_id column if missing (change from text to uuid if needed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'sender_id'
      AND data_type = 'uuid'
  ) THEN
    -- Check if sender_id exists as text
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'sender_id'
        AND data_type = 'text'
    ) THEN
      -- Drop the text column and recreate as uuid
      ALTER TABLE public.notifications DROP COLUMN sender_id;
      ALTER TABLE public.notifications ADD COLUMN sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'sender_id'
    ) THEN
      -- Column doesn't exist at all, add it
      ALTER TABLE public.notifications ADD COLUMN sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- Fix recipient_id if it's text instead of uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'recipient_id'
      AND data_type = 'text'
  ) THEN
    -- Convert text recipient_id to uuid
    -- First, remove any FK constraints that might exist
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey;
    
    -- Drop old recipient_id column
    ALTER TABLE public.notifications DROP COLUMN recipient_id;
    
    -- Add new uuid recipient_id column as nullable first
    ALTER TABLE public.notifications ADD COLUMN recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Clear all existing notifications (incompatible data from old schema)
    DELETE FROM public.notifications;
    
    -- Now make it NOT NULL
    ALTER TABLE public.notifications ALTER COLUMN recipient_id SET NOT NULL;
    
    RAISE NOTICE 'Converted recipient_id from TEXT to UUID (old notifications cleared)';
  END IF;
  
  -- Fix recipient_type if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'recipient_type'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN recipient_type text CHECK (recipient_type IN ('lead', 'faculty', 'admin')) DEFAULT 'lead';
  END IF;
  
  -- Fix sender_type if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'sender_type'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN sender_type text CHECK (sender_type IN ('system', 'faculty', 'admin')) DEFAULT 'system';
  END IF;
  
  -- Fix related_data if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'related_data'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN related_data jsonb DEFAULT '{}'::jsonb;
  END IF;
  
  -- Fix read_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'read_at'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN read_at timestamp with time zone;
  END IF;
END $$;

-- Notification broadcast history table (tracks which teams received bulk notifications)
CREATE TABLE IF NOT EXISTS public.notification_broadcasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type text DEFAULT 'faculty',
  recipient_filter text NOT NULL, -- 'all', 'department', or 'specific'
  department text,
  team_ids uuid[] DEFAULT ARRAY[]::uuid[],
  recipient_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- Notification templates table (for common notifications)
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  title text NOT NULL,
  message text NOT NULL,
  type text CHECK (type IN ('success', 'warning', 'info', 'error')) DEFAULT 'info',
  category text CHECK (category IN ('announcement', 'deadline', 'update', 'reminder', 'alert')) DEFAULT 'announcement',
  priority text CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT NOW()
);

-- ============================================================================
-- PART 2: ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_team ON notifications(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Broadcast history indexes
CREATE INDEX IF NOT EXISTS idx_broadcasts_sender ON notification_broadcasts(sender_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON notification_broadcasts(created_at DESC);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_active ON notification_templates(is_active) WHERE is_active = true;

-- ============================================================================
-- PART 3: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to send notification to multiple teams
CREATE OR REPLACE FUNCTION public.send_bulk_notification(
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_category text DEFAULT 'announcement',
  p_priority text DEFAULT 'normal',
  p_recipient_filter text DEFAULT 'all',
  p_department text DEFAULT NULL,
  p_team_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_sender_id uuid DEFAULT NULL,
  p_expires_in_days integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record record;
  v_notifications_sent integer := 0;
  v_broadcast_id uuid;
  v_sender_type text;
  v_expires_at timestamp with time zone;
  v_actual_sender_id uuid;
BEGIN
  -- Get actual sender ID (either passed or current user)
  v_actual_sender_id := COALESCE(p_sender_id, auth.uid());
  
  -- Validate sender has faculty or admin role
  SELECT role INTO v_sender_type FROM profiles WHERE id = v_actual_sender_id;
  
  IF v_sender_type NOT IN ('faculty', 'admin') THEN
    RAISE EXCEPTION 'Only faculty and admin users can send bulk notifications';
  END IF;
  
  -- Calculate expiration date if specified
  IF p_expires_in_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in_days || ' days')::interval;
  END IF;
  
  -- Create broadcast record
  INSERT INTO notification_broadcasts (
    title, message, sender_id, sender_type, recipient_filter, department, team_ids
  ) VALUES (
    p_title, p_message, v_actual_sender_id, v_sender_type, p_recipient_filter, p_department, p_team_ids
  ) RETURNING id INTO v_broadcast_id;
  
  -- Send notifications based on filter type
  IF p_recipient_filter = 'all' THEN
    -- Send to all team leaders
    FOR v_team_record IN 
      SELECT t.id as team_id, t.lead_id as recipient_id
      FROM teams t
      WHERE t.lead_id IS NOT NULL
    LOOP
      INSERT INTO notifications (
        title, message, type, category, priority, 
        recipient_id, recipient_type, sender_id, sender_type, 
        team_id, expires_at, related_data
      ) VALUES (
        p_title, p_message, p_type, p_category, p_priority,
        v_team_record.recipient_id, 'lead', v_actual_sender_id, v_sender_type,
        v_team_record.team_id, v_expires_at, 
        jsonb_build_object('broadcast_id', v_broadcast_id)
      );
      v_notifications_sent := v_notifications_sent + 1;
    END LOOP;
    
  ELSIF p_recipient_filter = 'department' THEN
    -- Send to teams in specific department
    FOR v_team_record IN 
      SELECT DISTINCT t.id as team_id, t.lead_id as recipient_id
      FROM teams t
      LEFT JOIN problem_statements ps ON t.selected_statement_id = ps.id
      WHERE (t.department = p_department OR ps.department = p_department)
        AND t.lead_id IS NOT NULL
    LOOP
      INSERT INTO notifications (
        title, message, type, category, priority,
        recipient_id, recipient_type, sender_id, sender_type,
        team_id, expires_at, related_data
      ) VALUES (
        p_title, p_message, p_type, p_category, p_priority,
        v_team_record.recipient_id, 'lead', v_actual_sender_id, v_sender_type,
        v_team_record.team_id, v_expires_at,
        jsonb_build_object('broadcast_id', v_broadcast_id, 'department', p_department)
      );
      v_notifications_sent := v_notifications_sent + 1;
    END LOOP;
    
  ELSIF p_recipient_filter = 'specific' THEN
    -- Send to specific teams
    FOR v_team_record IN 
      SELECT t.id as team_id, t.lead_id as recipient_id
      FROM teams t
      WHERE t.id = ANY(p_team_ids)
        AND t.lead_id IS NOT NULL
    LOOP
      INSERT INTO notifications (
        title, message, type, category, priority,
        recipient_id, recipient_type, sender_id, sender_type,
        team_id, expires_at, related_data
      ) VALUES (
        p_title, p_message, p_type, p_category, p_priority,
        v_team_record.recipient_id, 'lead', v_actual_sender_id, v_sender_type,
        v_team_record.team_id, v_expires_at,
        jsonb_build_object('broadcast_id', v_broadcast_id)
      );
      v_notifications_sent := v_notifications_sent + 1;
    END LOOP;
  END IF;
  
  -- Update broadcast with recipient count
  UPDATE notification_broadcasts 
  SET recipient_count = v_notifications_sent 
  WHERE id = v_broadcast_id;
  
  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'broadcast_id', v_broadcast_id,
    'notifications_sent', v_notifications_sent
  );
END;
$$;

-- Function to cleanup expired notifications
CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM notifications
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- PART 4: SET UP RLS POLICIES
-- ============================================================================

-- Drop ALL existing policies first (before enabling RLS)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Faculty and admin can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Faculty can create notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own_or_faculty" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own_or_admin" ON notifications;
DROP POLICY IF EXISTS "Faculty can view own broadcasts" ON notification_broadcasts;
DROP POLICY IF EXISTS "Faculty can create broadcasts" ON notification_broadcasts;
DROP POLICY IF EXISTS "Authenticated users can view active templates" ON notification_templates;
DROP POLICY IF EXISTS "Faculty can manage templates" ON notification_templates;

-- Enable RLS on all tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "Faculty and admin can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  get_current_user_role() IN ('faculty', 'admin')
);

-- Broadcast history policies
CREATE POLICY "Faculty can view own broadcasts"
ON public.notification_broadcasts
FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Faculty can create broadcasts" 
ON public.notification_broadcasts
FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() IN ('faculty', 'admin'));

-- Template policies
CREATE POLICY "Authenticated users can view active templates"
ON public.notification_templates
FOR SELECT
TO authenticated
USING (is_active = true OR created_by = auth.uid());

CREATE POLICY "Faculty can manage templates"
ON public.notification_templates
FOR ALL
TO authenticated
USING (get_current_user_role() IN ('faculty', 'admin'))
WITH CHECK (get_current_user_role() IN ('faculty', 'admin'));

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT ON notification_broadcasts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_templates TO authenticated;

GRANT EXECUTE ON FUNCTION send_bulk_notification TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications TO authenticated;

COMMIT;

-- ============================================================================
-- INSERT DEFAULT TEMPLATES
-- ============================================================================

INSERT INTO notification_templates (name, title, message, type, category, priority)
VALUES
  ('deadline_reminder', 'Submission Deadline Reminder', 'Don''t forget! Your project submission is due soon. Please ensure all requirements are met.', 'warning', 'deadline', 'high'),
  ('welcome', 'Welcome to the Hackathon!', 'Welcome! We''re excited to have you participate. Check your dashboard for problem statements and guidelines.', 'info', 'announcement', 'normal'),
  ('status_update', 'Application Status Update', 'Your submission status has been updated. Please check your dashboard for details.', 'info', 'update', 'normal'),
  ('urgent_alert', 'Urgent: Action Required', 'Important action required. Please check your dashboard immediately.', 'error', 'alert', 'urgent')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ==================================================================';
  RAISE NOTICE '✅ PRODUCTION-READY NOTIFICATION SYSTEM CONFIGURED SUCCESSFULLY!';
  RAISE NOTICE '✅ ==================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What was configured:';
  RAISE NOTICE '   ✓ Enhanced notifications table with all fields';
  RAISE NOTICE '   ✓ Notification broadcast history tracking';
  RAISE NOTICE '   ✓ Notification templates system';
  RAISE NOTICE '   ✓ Bulk notification function';
  RAISE NOTICE '   ✓ Auto-cleanup for expired notifications';
  RAISE NOTICE '   ✓ Complete RLS policies';
  RAISE NOTICE '   ✓ Performance indexes';
  RAISE NOTICE '   ✓ Default templates loaded';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Features Available:';
  RAISE NOTICE '   • Send to all teams';
  RAISE NOTICE '   • Send by department';
  RAISE NOTICE '   • Send to specific teams';
  RAISE NOTICE '   • Notification priority levels';
  RAISE NOTICE '   • Expiration dates';
  RAISE NOTICE '   • Broadcast history';
  RAISE NOTICE '   • Reusable templates';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Usage Example:';
  RAISE NOTICE '   SELECT send_bulk_notification(';
  RAISE NOTICE '     ''Important Update'',';
  RAISE NOTICE '     ''Please check your submissions'',';
  RAISE NOTICE '     ''warning'',';
  RAISE NOTICE '     ''announcement'',';
  RAISE NOTICE '     ''high'',';
  RAISE NOTICE '     ''all''';
  RAISE NOTICE '   );';
  RAISE NOTICE '';
END $$;
