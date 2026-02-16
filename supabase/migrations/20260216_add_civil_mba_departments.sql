-- Migration: Add CIVIL and MBA to department constraints
-- Date: 2026-02-16
-- Description: Updates department check constraints to include Civil Engineering and MBA programs

-- Update problem_statements table constraint
ALTER TABLE problem_statements DROP CONSTRAINT IF EXISTS problem_statements_department_check;
ALTER TABLE problem_statements 
ADD CONSTRAINT problem_statements_department_check 
CHECK (department IN ('CSE', 'AIDS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'MBA'));

-- Note: teams and members tables don't have check constraints currently
-- If they exist in the future, they should also be updated to include CIVIL and MBA
