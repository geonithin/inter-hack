-- ============================================================================
-- PRODUCTION READY SETUP: CUSTOM PROBLEM STATEMENTS FEATURE
-- ============================================================================
-- This script sets up the complete custom problem statements feature
-- Run this in your Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS and DROP policies IF EXISTS)
-- ============================================================================

-- INSTRUCTIONS:
-- 1. Open your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Copy and paste this entire script
-- 5. Click "Run" to execute
-- 6. Verify by checking the Tables section for "custom_problem_statements"

BEGIN;

-- ============================================================================
-- STEP 1: CREATE CUSTOM PROBLEM STATEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.custom_problem_statements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    description text NOT NULL CHECK (LENGTH(TRIM(description)) > 20),
    department text NOT NULL CHECK (department IN ('CSE', 'AIDS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'MBA')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamp with time zone DEFAULT NOW() NOT NULL,
    updated_at timestamp with time zone DEFAULT NOW() NOT NULL,
    
    -- Ensure team can only have one custom statement
    CONSTRAINT unique_team_custom_statement UNIQUE (team_id)
);

-- ============================================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_custom_statements_team_id ON custom_problem_statements(team_id);
CREATE INDEX IF NOT EXISTS idx_custom_statements_status ON custom_problem_statements(status);
CREATE INDEX IF NOT EXISTS idx_custom_statements_department ON custom_problem_statements(department);

-- ============================================================================
-- STEP 3: UPDATE SUBMISSIONS TABLE
-- ============================================================================

-- Add custom_statement_id column to submissions table
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS custom_statement_id uuid REFERENCES custom_problem_statements(id) ON DELETE SET NULL;

-- Add index for custom_statement_id
CREATE INDEX IF NOT EXISTS idx_submissions_custom_statement_id ON submissions(custom_statement_id);

-- Drop existing unique constraint if it exists
DROP INDEX IF EXISTS idx_submissions_unique_team_statement;

-- Add check constraint to ensure exactly one type of statement is referenced
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS check_statement_type;
ALTER TABLE submissions 
ADD CONSTRAINT check_statement_type CHECK (
    (statement_id IS NOT NULL AND custom_statement_id IS NULL) OR 
    (statement_id IS NULL AND custom_statement_id IS NOT NULL)
);

-- Add new unique constraints for both regular and custom statements
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_team_custom_statement 
ON submissions(team_id, custom_statement_id) WHERE custom_statement_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_team_statement 
ON submissions(team_id, statement_id) WHERE statement_id IS NOT NULL;

-- ============================================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE custom_problem_statements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: CREATE RLS POLICIES FOR CUSTOM PROBLEM STATEMENTS
-- ============================================================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Team leads manage own custom statements" ON custom_problem_statements;
DROP POLICY IF EXISTS "Faculty view all custom statements" ON custom_problem_statements;
DROP POLICY IF EXISTS "Faculty update custom statement status" ON custom_problem_statements;

-- Policy: Team leads can create and view their own custom statements
CREATE POLICY "Team leads manage own custom statements" 
ON custom_problem_statements
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM teams t 
        WHERE t.id = custom_problem_statements.team_id 
        AND t.lead_id = auth.uid()
    )
);

-- Policy: Faculty can view all custom statements
CREATE POLICY "Faculty view all custom statements" 
ON custom_problem_statements
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('faculty', 'admin')
    )
);

-- Policy: Faculty and admins can update status (approve/reject)
CREATE POLICY "Faculty update custom statement status" 
ON custom_problem_statements
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('faculty', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('faculty', 'admin')
    )
);

-- ============================================================================
-- STEP 6: UPDATE SUBMISSION POLICIES TO INCLUDE CUSTOM STATEMENTS
-- ============================================================================

-- Drop existing submission policies
DROP POLICY IF EXISTS "Team leads can manage their own submissions" ON submissions;
DROP POLICY IF EXISTS "Team leads manage own submissions" ON submissions;
DROP POLICY IF EXISTS "Faculty can view all submissions" ON submissions;
DROP POLICY IF EXISTS "Faculty view all submissions" ON submissions;
DROP POLICY IF EXISTS "Admins can manage all submissions" ON submissions;
DROP POLICY IF EXISTS "Admins manage all submissions" ON submissions;

-- Recreate with updated logic
CREATE POLICY "Team leads manage own submissions" 
ON submissions
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM teams t 
        WHERE t.id = submissions.team_id 
        AND t.lead_id = auth.uid()
    )
);

CREATE POLICY "Faculty view all submissions" 
ON submissions
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('faculty', 'admin')
    )
);

CREATE POLICY "Admins manage all submissions" 
ON submissions
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
    )
);

-- ============================================================================
-- STEP 7: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp for custom statements
CREATE OR REPLACE FUNCTION update_custom_statements_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS custom_statements_update_updated_at ON custom_problem_statements;

-- Create trigger to automatically update updated_at
CREATE TRIGGER custom_statements_update_updated_at
    BEFORE UPDATE ON custom_problem_statements
    FOR EACH ROW 
    EXECUTE FUNCTION update_custom_statements_updated_at();

-- ============================================================================
-- STEP 8: GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON custom_problem_statements TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- STEP 9: ADD HELPFUL COMMENTS
-- ============================================================================

COMMENT ON TABLE custom_problem_statements IS 'Stores custom problem statements created by teams';
COMMENT ON COLUMN custom_problem_statements.team_id IS 'References the team that created this custom statement';
COMMENT ON COLUMN custom_problem_statements.status IS 'Approval status: pending, approved, or rejected';
COMMENT ON COLUMN submissions.custom_statement_id IS 'References custom problem statement if submission is for a team-created statement';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after the script to verify everything is set up correctly

-- 1. Check if table was created successfully
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'custom_problem_statements'
) AS table_exists;

-- 2. Check RLS policies
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'custom_problem_statements'
ORDER BY policyname;

-- 3. Verify constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'custom_problem_statements'
ORDER BY constraint_type, constraint_name;

-- 4. Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'custom_problem_statements'
ORDER BY indexname;

-- 5. Verify submissions table has custom_statement_id column
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' 
    AND column_name = 'custom_statement_id'
) AS custom_statement_id_exists;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- 1. table_exists: true
-- 2. RLS policies: Should show 3 policies (team leads, faculty view, faculty update)
-- 3. Constraints: Should show check constraints and unique constraint
-- 4. Indexes: Should show 3 indexes for team_id, status, and department
-- 5. custom_statement_id_exists: true

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================
-- If you encounter any errors:
--
-- 1. "relation already exists" - This is OK, the table already exists
-- 2. "policy already exists" - This is OK, policies were recreated
-- 3. "column already exists" - This is OK, column was already added
-- 4. Foreign key violation - Make sure teams table exists first
-- 5. RLS errors - Make sure profiles table has role column
--
-- If issues persist, you can drop and recreate by uncommenting below:
-- DROP TABLE IF EXISTS custom_problem_statements CASCADE;
-- Then run this script again.

-- ============================================================================
-- FEATURE OVERVIEW
-- ============================================================================
/*
This feature allows teams to:
1. Create their own custom problem statements
2. Submit solutions for custom statements
3. Have statements reviewed and approved by faculty

Faculty can:
1. View all custom statements in a dedicated tab
2. Approve or reject custom statements
3. See which team created each statement
4. Track submission statistics

Database schema:
- custom_problem_statements table stores team-created statements
- submissions table links to either regular OR custom statements
- RLS policies ensure proper access control
- Triggers maintain updated_at timestamps
*/

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
