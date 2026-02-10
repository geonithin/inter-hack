-- COMPLETE DATABASE SETUP
-- Run this entire script in your Supabase SQL Editor to fix all issues

-- ====================================================================================
-- 1. SUBMISSIONS TABLE (Fix existing submissions functionality)
-- ====================================================================================

-- Drop existing table if it has issues and recreate with proper structure
DROP TABLE IF EXISTS submissions CASCADE;

-- Create submissions table with complete structure
CREATE TABLE submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    statement_id integer REFERENCES problem_statements(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text NOT NULL,
    tech_stack text NOT NULL DEFAULT '',
    solution_link text,
    status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected')),
    submitted_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_team_id ON submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_statement_id ON submissions(statement_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);

-- Ensure a team can only submit one idea per statement
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_team_statement ON submissions(team_id, statement_id);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for submissions
CREATE POLICY "Team leads can manage own submissions" ON submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM teams 
            WHERE teams.id = submissions.team_id 
            AND teams.lead_id = auth.uid()
        )
    );

CREATE POLICY "Faculty can view all submissions" ON submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('faculty', 'admin')
        )
    );

CREATE POLICY "Admins can manage all submissions" ON submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER submissions_update_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_submissions_updated_at();

-- ====================================================================================
-- 2. NOTIFICATIONS TABLE (Fix WebSocket realtime issues)
-- ====================================================================================

-- Drop existing table and policies to recreate with new schema
DROP TABLE IF EXISTS notifications CASCADE;

-- Create notifications table with text IDs to handle both integer and UUID
CREATE TABLE notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    message text NOT NULL,
    type text CHECK (type IN ('success', 'warning', 'info', 'error')) DEFAULT 'info',
    recipient_id text NOT NULL, -- Changed to text to handle both integer and UUID IDs
    recipient_type text CHECK (recipient_type IN ('faculty', 'team', 'admin')) NOT NULL,
    sender_id text, -- Changed to text to handle both integer and UUID IDs
    sender_type text CHECK (sender_type IN ('system', 'faculty', 'admin')) DEFAULT 'system',
    is_read boolean DEFAULT false,
    team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
    related_data jsonb, -- Store additional data like team status, etc.
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at timestamp with time zone
);

-- Enable RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications 
    FOR SELECT USING (recipient_id = auth.uid()::text);

CREATE POLICY "Users can create notifications" ON notifications 
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        (
            -- Faculty can create any notifications
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin')) OR
            -- Users can create notifications for themselves
            recipient_id = auth.uid()::text OR
            -- System notifications allowed
            sender_type = 'system'
        )
    );

CREATE POLICY "Users can update their own notifications" ON notifications 
    FOR UPDATE USING (recipient_id = auth.uid()::text);

CREATE POLICY "Users can delete their own notifications" ON notifications 
    FOR DELETE USING (recipient_id = auth.uid()::text);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_team_id ON notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ====================================================================================
-- 3. ENABLE REALTIME (Critical for WebSocket connections)
-- ====================================================================================

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable realtime for submissions table (optional but useful)
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;

-- ====================================================================================
-- 4. SAMPLE DATA (Optional - for testing)
-- ====================================================================================

-- Insert a test notification to verify functionality
INSERT INTO notifications (title, message, recipient_id, recipient_type, sender_type)
SELECT 'Welcome!', 'Your database is now properly configured.', id::text, 'faculty', 'system'
FROM profiles 
WHERE role IN ('faculty', 'admin')
LIMIT 1;

-- ====================================================================================
-- COMPLETION MESSAGE
-- ====================================================================================

-- This will show success in the SQL editor
SELECT 'Database setup completed successfully!' as status, 
       'WebSocket connections should now work properly.' as message;