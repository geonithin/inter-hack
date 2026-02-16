-- Add department check constraint to teams and members tables
-- This allows CIVIL and MBA departments in addition to existing departments

-- Update teams table
ALTER TABLE teams 
DROP CONSTRAINT IF EXISTS teams_department_check;

ALTER TABLE teams 
ADD CONSTRAINT teams_department_check 
CHECK (department IN ('CSE', 'AIDS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'MBA'));

-- Update members table
ALTER TABLE members 
DROP CONSTRAINT IF EXISTS members_department_check;

ALTER TABLE members 
ADD CONSTRAINT members_department_check 
CHECK (department IN ('CSE', 'AIDS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'MBA'));
