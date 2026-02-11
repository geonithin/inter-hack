-- ============================================================================
-- CLEAN NOTIFICATION SYSTEM SETUP
-- ============================================================================
-- This script drops and recreates the notifications table from scratch
-- Use this if you're getting check constraint errors from partial migrations
-- ============================================================================

BEGIN;

-- Drop everything and start fresh
DROP TABLE IF EXISTS public.notification_broadcasts CASCADE;
DROP TABLE IF EXISTS public.notification_templates CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Create fresh notifications table with correct structure
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
  statement_id integer REFERENCES problem_statements(id) ON DELETE SET NULL,
  priority text CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  category text CHECK (category IN ('announcement', 'deadline', 'update', 'reminder', 'alert')) DEFAULT 'announcement',
  related_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL,
  read_at timestamp with time zone,
  expires_at timestamp with time zone
);

-- Notification broadcast history table
CREATE TABLE public.notification_broadcasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type text DEFAULT 'faculty',
  recipient_filter text NOT NULL,
  department text,
  team_ids uuid[] DEFAULT ARRAY[]::uuid[],
  recipient_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- Notification templates table
CREATE TABLE public.notification_templates (
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

-- Create indexes
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_team ON notifications(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_broadcasts_sender ON notification_broadcasts(sender_id);
CREATE INDEX idx_broadcasts_created ON notification_broadcasts(created_at DESC);
CREATE INDEX idx_templates_active ON notification_templates(is_active) WHERE is_active = true;

-- Create function
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
  v_actual_sender_id := COALESCE(p_sender_id, auth.uid());
  SELECT role INTO v_sender_type FROM profiles WHERE id = v_actual_sender_id;
  
  IF v_sender_type NOT IN ('faculty', 'admin') THEN
    RAISE EXCEPTION 'Only faculty and admin users can send bulk notifications';
  END IF;
  
  IF p_expires_in_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in_days || ' days')::interval;
  END IF;
  
  INSERT INTO notification_broadcasts (
    title, message, sender_id, sender_type, recipient_filter, department, team_ids
  ) VALUES (
    p_title, p_message, v_actual_sender_id, v_sender_type, p_recipient_filter, p_department, p_team_ids
  ) RETURNING id INTO v_broadcast_id;
  
  IF p_recipient_filter = 'all' THEN
    FOR v_team_record IN 
      SELECT t.id as team_id, t.lead_id as recipient_id
      FROM teams t WHERE t.lead_id IS NOT NULL
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
    FOR v_team_record IN 
      SELECT t.id as team_id, t.lead_id as recipient_id
      FROM teams t WHERE t.id = ANY(p_team_ids) AND t.lead_id IS NOT NULL
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
  
  UPDATE notification_broadcasts 
  SET recipient_count = v_notifications_sent 
  WHERE id = v_broadcast_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'broadcast_id', v_broadcast_id,
    'notifications_sent', v_notifications_sent
  );
END;
$$;

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < NOW();
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "Faculty and admin can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (get_current_user_role() IN ('faculty', 'admin'));

CREATE POLICY "Faculty can view own broadcasts"
ON public.notification_broadcasts FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Faculty can create broadcasts" 
ON public.notification_broadcasts FOR INSERT TO authenticated
WITH CHECK (get_current_user_role() IN ('faculty', 'admin'));

CREATE POLICY "Authenticated users can view active templates"
ON public.notification_templates FOR SELECT TO authenticated
USING (is_active = true OR created_by = auth.uid());

CREATE POLICY "Faculty can manage templates"
ON public.notification_templates FOR ALL TO authenticated
USING (get_current_user_role() IN ('faculty', 'admin'))
WITH CHECK (get_current_user_role() IN ('faculty', 'admin'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT ON notification_broadcasts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_templates TO authenticated;
GRANT EXECUTE ON FUNCTION send_bulk_notification TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications TO authenticated;

COMMIT;

-- Insert default templates
INSERT INTO notification_templates (name, title, message, type, category, priority)
VALUES
  ('deadline_reminder', 'Submission Deadline Reminder', 'Don''t forget! Your project submission is due soon. Please ensure all requirements are met.', 'warning', 'deadline', 'high'),
  ('welcome', 'Welcome to the Hackathon!', 'Welcome! We''re excited to have you participate. Check your dashboard for problem statements and guidelines.', 'info', 'announcement', 'normal'),
  ('status_update', 'Application Status Update', 'Your submission status has been updated. Please check your dashboard for details.', 'info', 'update', 'normal'),
  ('urgent_alert', 'Urgent: Action Required', 'Important action required. Please check your dashboard immediately.', 'error', 'alert', 'urgent');

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ NOTIFICATION SYSTEM SETUP COMPLETE!';
  RAISE NOTICE '✅ All tables dropped and recreated with correct structure';
  RAISE NOTICE '✅ Old notifications cleared (fresh start)';
END $$;
