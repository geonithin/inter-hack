-- Enable Extensions
create extension if not exists "uuid-ossp";

-- Profiles table for shared user data
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('lead', 'faculty', 'admin')) default 'lead',
  email text unique
);

-- Teams table
create table if not exists teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  department text,
  year text,
  section text,
  lead_id uuid references profiles(id) on delete cascade unique,
  status text check (status in ('Pending', 'Selected', 'Rejected')) default 'Pending',
  selected_statement_id integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Members table
create table if not exists members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  register_number text not null,
  email text,
  phone text,
  department text,
  year text,
  section text
);

-- Submissions table
create table if not exists submissions (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references teams(id) on delete cascade,
  statement_id integer not null,
  title text not null,
  description text not null,
  tech_stack text,
  solution_link text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies Enabling
alter table if exists profiles enable row level security;
alter table if exists teams enable row level security;
alter table if exists members enable row level security;
alter table if exists submissions enable row level security;

-- Drop existing policies to avoid "already exists" errors
drop policy if exists "Public profiles are viewable by everyone" on profiles;
drop policy if exists "Users can insert their own profile" on profiles;
drop policy if exists "Users can update their own profile" on profiles;
drop policy if exists "Teams are viewable by everyone" on teams;
drop policy if exists "Users can insert their own team" on teams;
drop policy if exists "Leads can update their own team" on teams;
drop policy if exists "Members are viewable by everyone" on members;
drop policy if exists "Leads can insert members to their team" on members;
drop policy if exists "Submissions are viewable by team leads and faculty" on submissions;
drop policy if exists "Leads can insert submissions to their team" on submissions;

-- Trigger to handle profile creation automatically on auth.signUp
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Insert profile with proper error handling
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'lead')
  ) 
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    email = excluded.email,
    role = coalesce(excluded.role, profiles.role);
  
  return new;
exception
  when others then
    -- Log the error but don't fail the user creation
    raise log 'Error creating profile for user %: %', new.id, SQLERRM;
    return new;
end;
$$;

-- Ensure the trigger is set
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Basic Policies
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);

create policy "Teams are viewable by everyone" on teams for select using (true);
create policy "Users can insert their own team" on teams for insert with check (auth.uid() = lead_id);
create policy "Leads can update their own team" on teams for update using (auth.uid() = lead_id);

create policy "Members are viewable by everyone" on members for select using (true);
create policy "Leads can insert members to their team" on members for insert with check (
  exists (
    select 1 from teams 
    where teams.id = team_id 
    and teams.lead_id = auth.uid()
  )
);

create policy "Submissions are viewable by team leads and faculty" on submissions for select using (
  auth.uid() in (select lead_id from teams where id = team_id) or 
  (select role from profiles where id = auth.uid()) in ('faculty', 'admin')
);

create policy "Leads can insert submissions to their team" on submissions for insert with check (
  exists (
    select 1 from teams 
    where teams.id = team_id 
    and teams.lead_id = auth.uid()
  )
);
