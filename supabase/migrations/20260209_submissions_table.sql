-- Create submissions table for idea submissions
drop table if exists submissions cascade;

-- First, ensure teams table has proper foreign key for selected_statement_id
do $$
begin
    -- Check if selected_statement_id column exists in teams table
    if exists (
        select 1 from information_schema.columns 
        where table_name = 'teams' and column_name = 'selected_statement_id'
    ) then
        -- Drop existing constraint if it exists
        if exists (
            select 1 from information_schema.table_constraints 
            where constraint_name = 'teams_selected_statement_id_fkey'
        ) then
            alter table teams drop constraint teams_selected_statement_id_fkey;
        end if;
        
        -- Add proper foreign key constraint
        alter table teams add constraint teams_selected_statement_id_fkey 
        foreign key (selected_statement_id) references problem_statements(id);
    else
        -- Add the column if it doesn't exist
        alter table teams add column selected_statement_id integer;
        alter table teams add constraint teams_selected_statement_id_fkey 
        foreign key (selected_statement_id) references problem_statements(id);
    end if;
end $$;

create table submissions (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    statement_id integer not null references problem_statements(id) on delete cascade,
    title text not null,
    description text not null,
    tech_stack text not null,
    solution_link text, -- Optional external link
    status text default 'submitted' check (status in ('submitted', 'under_review', 'accepted', 'rejected')),
    submitted_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    created_at timestamp with time zone default now()
);

-- Add indexes for better query performance
create index idx_submissions_team_id on submissions(team_id);
create index idx_submissions_statement_id on submissions(statement_id);
create index idx_submissions_status on submissions(status);
create index idx_submissions_submitted_at on submissions(submitted_at);

-- Ensure a team can only submit one idea per problem statement
create unique index idx_submissions_unique_team_statement on submissions(team_id, statement_id);

-- Add RLS policies for submissions
alter table submissions enable row level security;

-- Policy: Team leads can view and insert their own team's submissions
create policy "Team leads can manage their own submissions" on submissions
    for all using (
        exists (
            select 1 from teams t 
            where t.id = submissions.team_id 
            and t.lead_id = auth.uid()
        )
    );

-- Policy: Faculty can view all submissions
create policy "Faculty can view all submissions" on submissions
    for select using (
        exists (
            select 1 from profiles p 
            where p.id = auth.uid() 
            and p.role = 'faculty'
        )
    );

-- Policy: Admins can manage all submissions
create policy "Admins can manage all submissions" on submissions
    for all using (
        exists (
            select 1 from profiles p 
            where p.id = auth.uid() 
            and p.role = 'admin'
        )
    );

-- Function to update updated_at timestamp
create or replace function update_submissions_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql security definer;

-- Trigger to automatically update updated_at
create trigger submissions_update_updated_at
    before update on submissions
    for each row execute function update_submissions_updated_at();

-- Function to create submission notification
create or replace function create_submission_notification()
returns trigger as $$
declare
    team_record record;
    statement_record record;
begin
    -- Get team and statement information
    select t.name, t.lead_id into team_record
    from teams t where t.id = new.team_id;
    
    select ps.title into statement_record
    from problem_statements ps where ps.id = new.statement_id;
    
    -- Create notification for team lead
    insert into notifications (
        title,
        message,
        type,
        recipient_id,
        recipient_type,
        sender_type,
        team_id,
        related_data
    ) values (
        'Idea Submitted Successfully!',
        'Your team "' || team_record.name || '" has successfully submitted their idea for "' || statement_record.title || '". You can view your submission details in the dashboard.',
        'success',
        team_record.lead_id::text,
        'team',
        'system',
        new.team_id,
        jsonb_build_object(
            'submission_id', new.id,
            'team_name', team_record.name,
            'statement_title', statement_record.title,
            'submitted_at', new.submitted_at
        )
    );
    
    -- Create notification for faculty (optional - for faculty dashboard)
    insert into notifications (
        title,
        message,
        type,
        recipient_id,
        recipient_type,
        sender_type,
        team_id,
        related_data
    ) select
        'New Idea Submission',
        'Team "' || team_record.name || '" has submitted their idea for "' || statement_record.title || '".',
        'info',
        p.id::text,
        'faculty',
        'system',
        new.team_id,
        jsonb_build_object(
            'submission_id', new.id,
            'team_name', team_record.name,
            'statement_title', statement_record.title,
            'submitted_at', new.submitted_at
        )
    from profiles p
    where p.role = 'faculty';
    
    return new;
end;
$$ language plpgsql security definer;

-- Trigger to create notifications on submission
create trigger submissions_create_notification
    after insert on submissions
    for each row execute function create_submission_notification();

-- Sample view for faculty dashboard to see submission stats
create or replace view submission_stats as
select 
    ps.id as statement_id,
    ps.title as statement_title,
    ps.department,
    count(s.id) as submission_count,
    count(distinct s.team_id) as team_count,
    array_agg(
        jsonb_build_object(
            'team_name', t.name,
            'submission_title', s.title,
            'submitted_at', s.submitted_at,
            'status', s.status
        ) order by s.submitted_at desc
    ) filter (where s.id is not null) as submissions
from problem_statements ps
left join submissions s on ps.id = s.statement_id
left join teams t on s.team_id = t.id
where ps.is_active = true
group by ps.id, ps.title, ps.department
order by ps.title;

-- Grant permissions
grant select on submission_stats to authenticated;
grant all on submissions to authenticated;

-- Add helpful comments
comment on table submissions is 'Stores team idea submissions for problem statements';
comment on column submissions.team_id is 'References the team that made the submission';
comment on column submissions.statement_id is 'References the problem statement being solved';
comment on column submissions.status is 'Current status of the submission (submitted, under_review, accepted, rejected)';
comment on column submissions.solution_link is 'Optional external link to GitHub, Figma, etc.';

-- Add constraint to prevent submission after certain date (optional)
-- alter table submissions add constraint submissions_deadline_check 
-- check (submitted_at <= '2026-02-15 23:59:59+00'::timestamptz);

-- Insert some sample data for testing (optional)
-- Note: Uncomment and modify these if you want test data
/*
insert into submissions (team_id, statement_id, title, description, tech_stack, solution_link)
select 
    t.id,
    ps.id,
    'Smart Traffic AI Solution',
    'Our solution uses machine learning algorithms to optimize traffic flow in real-time, reducing congestion by up to 40%.',
    'Python, TensorFlow, React, Node.js, PostgreSQL',
    'https://github.com/example/smart-traffic'
from teams t, problem_statements ps
where t.name = 'Tech Innovators' and ps.title like '%TRAFFIC%'
limit 1;
*/