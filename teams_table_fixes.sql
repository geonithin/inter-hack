-- Fix teams table schema for registration
-- Run this in your Supabase SQL Editor after the other migrations

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

-- Create trigger to auto-update updated_at on teams table
drop trigger if exists update_teams_updated_at on teams;
create trigger update_teams_updated_at
  before update on teams
  for each row
  execute function update_updated_at_column();

-- Drop and recreate policies to ensure they work properly
drop policy if exists "Users can insert their own team" on teams;
drop policy if exists "Leads can update their own team" on teams;
drop policy if exists "Faculty can update team status" on teams;
drop policy if exists "Authenticated users can update teams" on teams;
drop policy if exists "Any authenticated user can update teams" on teams;
drop policy if exists "Teams are viewable by everyone" on teams;
drop policy if exists "Allow all operations on teams" on teams;

-- Completely permissive policy for debugging (TEMPORARY)
create policy "Allow all operations on teams" on teams 
for all 
using (true) 
with check (true);

-- Debug: Create a simple function to check current user details
create or replace function debug_current_user()
returns json as $$
begin
  return json_build_object(
    'auth_uid', auth.uid(),
    'auth_uid_type', pg_typeof(auth.uid()),
    'auth_role', auth.role(),
    'profile_exists', exists(select 1 from profiles where id = auth.uid()),
    'profile_by_text', exists(select 1 from profiles where id::text = auth.uid()::text),
    'user_profile', (select json_build_object('id', id, 'role', role, 'full_name', full_name) from profiles where id = auth.uid() or id::text = auth.uid()::text limit 1),
    'all_profiles', (select array_agg(json_build_object('id', id, 'role', role, 'full_name', full_name)) from profiles)
  );
end;
$$ language plpgsql security definer;

-- Ensure members table policies are correct too
drop policy if exists "Leads can insert members to their team" on members;
drop policy if exists "Members are viewable by everyone" on members;

create policy "Members are viewable by everyone" on members 
for select 
using (true);

create policy "Leads can insert members to their team" on members 
for insert 
with check (
  exists (
    select 1 from teams 
    where teams.id = team_id 
    and teams.lead_id = auth.uid()
  )
);
