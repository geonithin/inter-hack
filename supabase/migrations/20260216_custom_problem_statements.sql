-- ============================================================================
-- CUSTOM PROBLEM STATEMENTS FEATURE
-- ============================================================================
-- This migration adds support for teams to create their own problem statements
-- Teams can define their own problems to work on instead of selecting pre-defined ones
-- ============================================================================

BEGIN;

-- Create custom_problem_statements table
CREATE TABLE IF NOT EXISTS public.custom_problem_statements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    description text NOT NULL CHECK (LENGTH(TRIM(description)) > 20),
    department text NOT NULL CHECK (department IN ('CSE', 'AIDS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'MBA')),
    created_at timestamp with time zone DEFAULT NOW() NOT NULL,
    updated_at timestamp with time zone DEFAULT NOW() NOT NULL,
    
    -- Ensure team can only have one custom statement
    CONSTRAINT unique_team_custom_statement UNIQUE (team_id)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_statements_team_id ON custom_problem_statements(team_id);
CREATE INDEX IF NOT EXISTS idx_custom_statements_department ON custom_problem_statements(department);

-- Add a new column to submissions to track if it's for a custom statement
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS custom_statement_id uuid REFERENCES custom_problem_statements(id) ON DELETE SET NULL;

-- Add index for custom_statement_id
CREATE INDEX IF NOT EXISTS idx_submissions_custom_statement_id ON submissions(custom_statement_id);

-- Modify the constraint: either statement_id OR custom_statement_id must be set, but not both
-- Drop existing unique constraint
DROP INDEX IF EXISTS idx_submissions_unique_team_statement;

-- Add check constraint to ensure exactly one type of statement is referenced
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS check_statement_type;
ALTER TABLE submissions 
ADD CONSTRAINT check_statement_type CHECK (
    (statement_id IS NOT NULL AND custom_statement_id IS NULL) OR 
    (statement_id IS NULL AND custom_statement_id IS NOT NULL)
);

-- Add new unique constraint for custom statements
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_team_custom_statement 
ON submissions(team_id, custom_statement_id) WHERE custom_statement_id IS NOT NULL;

-- Recreate unique index for regular statements
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_team_statement 
ON submissions(team_id, statement_id) WHERE statement_id IS NOT NULL;

-- Enable RLS
ALTER TABLE custom_problem_statements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR CUSTOM PROBLEM STATEMENTS
-- ============================================================================

-- Drop existing policies if they exist
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

-- Policy: Faculty and admins can view all custom statements
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

-- ============================================================================
-- UPDATE SUBMISSION POLICIES TO INCLUDE CUSTOM STATEMENTS
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
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp for custom statements
CREATE OR REPLACE FUNCTION update_custom_statements_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS custom_statements_update_updated_at ON custom_problem_statements;
CREATE TRIGGER custom_statements_update_updated_at
    BEFORE UPDATE ON custom_problem_statements
    FOR EACH ROW 
    EXECUTE FUNCTION update_custom_statements_updated_at();

-- Function to get all statements (predefined + custom) for a department
CREATE OR REPLACE FUNCTION get_all_statements_for_department(dept text)
RETURNS TABLE (
    id text,
    type text,
    title text,
    description text,
    department text,
    is_active boolean,
    team_count integer
) AS $$
BEGIN
    RETURN QUERY
    -- Get predefined statements
    SELECT 
        'predefined_' || ps.id::text as id,
        'predefined'::text as type,
        ps.title,
        ps.description,
        ps.department,
        ps.is_active,
        (SELECT COUNT(*)::integer FROM teams WHERE selected_statement_id = ps.id) as team_count
    FROM problem_statements ps
    WHERE ps.department = dept AND ps.is_active = true
    
    UNION ALL
    
    -- Get custom statements
    SELECT 
        'custom_' || cs.id::text as id,
        'custom'::text as type,
        cs.title,
        cs.description,
        cs.department,
        true::boolean as is_active,  -- Custom statements are immediately active
        1::integer as team_count  -- Custom statements are team-specific
    FROM custom_problem_statements cs
    WHERE cs.department = dept;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant appropriate permissions
GRANT ALL ON custom_problem_statements TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add helpful comments
COMMENT ON TABLE custom_problem_statements IS 'Stores custom problem statements created by teams';
COMMENT ON COLUMN custom_problem_statements.team_id IS 'References the team that created this custom statement';
COMMENT ON COLUMN submissions.custom_statement_id IS 'References custom problem statement if submission is for a team-created statement';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the setup)
-- ============================================================================

-- Check if table was created
-- SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_problem_statements');

-- Check RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'custom_problem_statements';

-- Verify constraints
-- SELECT * FROM information_schema.table_constraints WHERE table_name = 'custom_problem_statements';
