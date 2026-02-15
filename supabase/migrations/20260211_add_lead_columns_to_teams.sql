-- Add lead information columns to teams table
-- These columns store detailed lead information directly in the teams table

-- Add missing columns to teams table if they don't exist
do $$
begin
  -- Add lead_name column
  if not exists (select 1 from information_schema.columns where table_name = 'teams' and column_name = 'lead_name') then
    alter table teams add column lead_name text;
  end if;
  
  -- Add lead_email column  
  if not exists (select 1 from information_schema.columns where table_name = 'teams' and column_name = 'lead_email') then
    alter table teams add column lead_email text;
  end if;
  
  -- Add lead_register_number column
  if not exists (select 1 from information_schema.columns where table_name = 'teams' and column_name = 'lead_register_number') then
    alter table teams add column lead_register_number text;
  end if;
  
  -- Add lead_phone column
  if not exists (select 1 from information_schema.columns where table_name = 'teams' and column_name = 'lead_phone') then
    alter table teams add column lead_phone text;
  end if;
  
  -- Add updated_at column
  if not exists (select 1 from information_schema.columns where table_name = 'teams' and column_name = 'updated_at') then
    alter table teams add column updated_at timestamp with time zone default timezone('utc'::text, now());
  end if;
end
$$;

-- Update existing teams to populate lead info from profiles (if any exist)
update teams 
set 
  lead_name = profiles.full_name,
  lead_email = profiles.email
from profiles 
where teams.lead_id = profiles.id 
and (teams.lead_name is null or teams.lead_email is null);

-- Create a function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
drop trigger if exists update_teams_updated_at on teams;
create trigger update_teams_updated_at
  before update on teams
  for each row
  execute function update_updated_at_column();
