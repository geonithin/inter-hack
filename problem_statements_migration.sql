-- Create problem statements table and seed data
-- Run this in your Supabase SQL Editor

-- Create problem_statements table
create table if not exists problem_statements (
  id serial primary key,
  title text not null,
  description text not null,
  department text not null check (department in ('CS', 'EC', 'ME', 'CE', 'EE')),
  max_teams integer default 3,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for problem_statements
alter table problem_statements enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Problem statements are viewable by everyone" on problem_statements;
drop policy if exists "Faculty and admin can manage problem statements" on problem_statements;

-- Allow everyone to view problem statements
create policy "Problem statements are viewable by everyone" on problem_statements for select using (is_active = true);

-- Allow faculty and admin to manage problem statements
create policy "Faculty and admin can manage problem statements" on problem_statements for all using (
  (select role from profiles where id = auth.uid()) in ('faculty', 'admin')
);

-- Insert sample problem statements
insert into problem_statements (title, description, department, max_teams) values
('AI Driven Traffic Management System', 'Optimize urban traffic flows using real-time sensor data and machine learning algorithms to reduce congestion. Implement predictive analytics to forecast traffic patterns and automatically adjust signal timing to minimize wait times and improve overall city mobility.', 'CS', 3),
('Blockchain for Academic Verifications', 'Secure and immutable platform for verifying college certificates and transcripts using Ethereum blockchain. Create a decentralized system that prevents certificate fraud and allows instant verification by employers and other institutions worldwide.', 'CS', 3),
('Smart Agriculture IoT Node', 'Low-power sensor network for monitoring soil health and automated irrigation systems for precision farming. Develop wireless sensors that track moisture, pH, nutrients, and weather conditions to optimize crop yields while conserving water resources.', 'EC', 3),
('Autonomous Underwater Vehicle', 'Miniature drone for underwater exploration and maintenance of subsea pipelines and hardware. Design a compact, autonomous vehicle capable of navigating complex underwater environments and performing basic inspection and repair tasks.', 'ME', 3),
('Personalized Healthcare Chatbot', 'NLP-based virtual assistant for preliminary symptom diagnosis and medication reminders for chronic patients. Integrate with medical databases and provide personalized health advice while ensuring patient privacy and data security.', 'CS', 3),
('Assistive Wearable for Visually Impaired', 'Smart glasses using ultrasonic sensors and computer vision to navigate obstacle-rich environments. Create an affordable, lightweight device that provides real-time audio feedback about surroundings and navigation assistance.', 'EC', 3),
('Sustainable Building Energy Management', 'IoT-based system for optimizing energy consumption in smart buildings. Monitor and control HVAC, lighting, and electrical systems automatically to reduce energy costs while maintaining optimal comfort levels for occupants.', 'EE', 3),
('Disaster Response Communication Network', 'Mesh network communication system for emergency situations when traditional infrastructure fails. Design a resilient network that enables first responders and civilians to communicate effectively during natural disasters or emergencies.', 'EC', 3);

-- Update teams table to use proper foreign key
-- First, check if the column exists and update it
do $$
begin
  -- Check if selected_statement_id column exists
  if exists (select 1 from information_schema.columns where table_name = 'teams' and column_name = 'selected_statement_id') then
    -- Update the column to be a proper foreign key
    alter table teams drop constraint if exists teams_selected_statement_id_fkey;
    alter table teams add constraint teams_selected_statement_id_fkey 
      foreign key (selected_statement_id) references problem_statements(id);
  else
    -- Add the column if it doesn't exist
    alter table teams add column selected_statement_id integer references problem_statements(id);
  end if;
end
$$;

-- Create faculty table for authentication
create table if not exists faculty (
  id serial primary key,
  faculty_id text unique not null, -- Unique faculty identifier (e.g., FAC001)
  name text not null,
  email text unique not null,
  password text not null, -- In production, this should be hashed
  department text not null check (department in ('CS', 'EC', 'ME', 'CE', 'EE')),
  designation text default 'Assistant Professor',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for faculty
alter table faculty enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Faculty can view own record" on faculty;
drop policy if exists "Admin can manage faculty" on faculty;
drop policy if exists "Allow faculty login" on faculty;

-- Allow public access for faculty login (authentication check)
create policy "Allow faculty login" on faculty for select using (is_active = true);

-- Allow admin to manage all faculty records
create policy "Admin can manage faculty" on faculty for all using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

-- Insert default faculty record
insert into faculty (faculty_id, name, email, password, department, designation) values
('FAC001', 'Default Faculty', 'faculty@college.edu', '123456', 'CS', 'Professor')
on conflict (faculty_id) do nothing;

-- Note: In production, passwords should be properly hashed using bcrypt or similar