-- Create notifications table and management system
-- Run this in your Supabase SQL Editor

-- Drop existing table and policies to recreate with new schema
drop table if exists notifications cascade;

-- Create notifications table with text IDs to handle both integer and UUID
create table notifications (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  message text not null,
  type text check (type in ('success', 'warning', 'info', 'error')) default 'info',
  recipient_id text not null, -- Changed to text to handle both integer and UUID IDs
  recipient_type text check (recipient_type in ('faculty', 'team', 'admin')) not null,
  sender_id text, -- Changed to text to handle both integer and UUID IDs
  sender_type text check (sender_type in ('system', 'faculty', 'admin')) default 'system',
  is_read boolean default false,
  team_id uuid references teams(id) on delete cascade,
  related_data jsonb, -- Store additional data like team status, etc.
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  read_at timestamp with time zone
);

-- Enable RLS for notifications
alter table notifications enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own notifications" on notifications;
drop policy if exists "Faculty can create notifications" on notifications;
drop policy if exists "Users can create notifications" on notifications;
drop policy if exists "Users can update their own notifications" on notifications;
drop policy if exists "Users can delete their own notifications" on notifications;

-- Allow users to view their own notifications
create policy "Users can view their own notifications" on notifications 
  for select using (recipient_id = auth.uid()::text);

-- Allow authenticated users to create notifications 
create policy "Users can create notifications" on notifications 
  for insert with check (
    auth.uid() is not null AND
    (
      -- Faculty can create any notifications (check by auth.uid matching profiles)
      exists (select 1 from profiles where id = auth.uid() and role in ('faculty', 'admin')) OR
      -- Users can create notifications for themselves
      recipient_id = auth.uid()::text OR
      -- Users can create system notifications
      sender_type = 'system' OR
      -- Allow authenticated users to create notifications (simplified policy)
      true
    )
  );

-- Allow users to update their own notifications (mark as read)
create policy "Users can update their own notifications" on notifications 
  for update using (recipient_id = auth.uid()::text);

-- Allow users to delete their own notifications
create policy "Users can delete their own notifications" on notifications 
  for delete using (recipient_id = auth.uid()::text);

-- Create indexes for better performance
create index if not exists notifications_recipient_id_idx on notifications(recipient_id);
create index if not exists notifications_team_id_idx on notifications(team_id);
create index if not exists notifications_created_at_idx on notifications(created_at desc);
create index if not exists notifications_is_read_idx on notifications(is_read);

-- Create function to create team status notifications
-- Drop any existing versions first to avoid function overloading conflicts
drop function if exists create_team_status_notification(uuid, text, uuid);
drop function if exists create_team_status_notification(uuid, text, text);

create or replace function create_team_status_notification(
  p_team_id uuid,
  p_new_status text,
  p_faculty_id text  -- Using text to handle both integer and UUID IDs
) returns void as $$
declare
  team_record record;
  lead_profile record;
  statement_title text := null;
begin
  -- Get team information (handle missing problem_statements table)
  select t.name, t.lead_id
  into team_record
  from teams t
  where t.id = p_team_id;
  
  -- Try to get statement title if problem_statements table exists
  begin
    select ps.title into statement_title
    from teams t
    left join problem_statements ps on t.selected_statement_id = ps.id
    where t.id = p_team_id;
  exception when others then
    -- If problem_statements table doesn't exist, continue without statement title
    statement_title := null;
  end;
  
  -- Get team lead profile
  select * into lead_profile from profiles where id = team_record.lead_id;
  
  if team_record.name is not null then
    -- Create notification for team lead
    insert into notifications (
      title,
      message,
      type,
      recipient_id,
      recipient_type,
      sender_id,
      sender_type,
      team_id,
      related_data
    ) values (
      'Team Status Updated',
      case 
        when p_new_status = 'Selected' then 'Congratulations! Your team "' || team_record.name || '" has been SELECTED for the hackathon!'
        when p_new_status = 'Rejected' then 'Your team "' || team_record.name || '" status has been updated to REJECTED.'
        else 'Your team "' || team_record.name || '" status has been updated to ' || p_new_status || '.'
      end,
      case 
        when p_new_status = 'Selected' then 'success'
        when p_new_status = 'Rejected' then 'error'
        else 'info'
      end,
      team_record.lead_id::text,  -- Convert to text
      'team',
      p_faculty_id,
      'faculty',
      p_team_id,
      jsonb_build_object(
        'team_name', team_record.name,
        'new_status', p_new_status,
        'statement_title', coalesce(statement_title, 'No statement selected')
      )
    );
    
    -- Create notification for faculty dashboard
    insert into notifications (
      title,
      message,
      type,
      recipient_id,
      recipient_type,
      sender_id,
      sender_type,
      team_id,
      related_data
    ) values (
      'Team Status Updated',
      'Team "' || team_record.name || '" status changed to ' || p_new_status || '.',
      'info',
      p_faculty_id,
      'faculty',
      p_faculty_id,
      'system',
      p_team_id,
      jsonb_build_object(
        'team_name', team_record.name,
        'new_status', p_new_status,
        'lead_name', coalesce(lead_profile.full_name, 'Unknown')
      )
    );
  end if;
end;
$$ language plpgsql security definer;

-- Sample notifications for testing
-- Insert some initial notifications (optional)
insert into notifications (title, message, type, recipient_id, recipient_type, sender_type, related_data) 
select 
  'Welcome to SMCE Hackathon!',
  'Your registration has been confirmed. Good luck with your project!',
  'success',
  p.id::text,  -- Convert UUID to text
  case when p.role = 'faculty' then 'faculty' else 'team' end,
  'system',
  jsonb_build_object('welcome', true)
from profiles p
where p.role in ('lead', 'faculty')
limit 5; -- Limit to avoid too many test notifications