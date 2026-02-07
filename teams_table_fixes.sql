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

-- Drop and recreate policies to ensure they work properly
drop policy if exists "Users can insert their own team" on teams;
drop policy if exists "Leads can update their own team" on teams;
drop policy if exists "Teams are viewable by everyone" on teams;

-- Create policies that allow team insertion for authenticated users
create policy "Users can insert their own team" on teams 
for insert 
with check (auth.uid() = lead_id);

create policy "Leads can update their own team" on teams 
for update 
using (auth.uid() = lead_id);

-- Allow public read access to teams for faculty dashboard
create policy "Teams are viewable by everyone" on teams 
for select 
using (true);

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