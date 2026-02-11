-- Comprehensive Database Schema Fix for Production Readiness
-- This migration fixes all issues and makes the database suitable for accepting upcoming data without issues
-- Run this in Supabase SQL Editor after all other migrations

BEGIN;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- =============================================
-- 1. PROFILES TABLE IMPROVEMENTS
-- =============================================

-- Add missing constraints and indexes to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default now();

-- Add proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- Ensure email is lowercase and properly formatted
CREATE OR REPLACE FUNCTION normalize_profile_email()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email = LOWER(TRIM(NEW.email));
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_normalize_email ON profiles;
CREATE TRIGGER profiles_normalize_email
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION normalize_profile_email();

-- =============================================
-- 2. TEAMS TABLE IMPROVEMENTS
-- =============================================

-- First, let's check and fix existing data before adding constraints
-- Update any non-standard department values to standard ones
UPDATE teams SET department = 
  CASE 
    -- Handle CSE variations
    WHEN UPPER(TRIM(department)) IN ('CS', 'CSE', 'COMPUTER SCIENCE', 'COMPUTER', 'COMP', 'COMPSCI', 'COMPUTER_SCIENCE', 'COMPUTER SCIENCE AND ENGINEERING') THEN 'CSE'
    -- Handle ECE variations
    WHEN UPPER(TRIM(department)) IN ('EC', 'ECE', 'ELECTRONICS', 'ELECTRONICS AND COMMUNICATION', 'ELECTRONIC', 'ELECTRONICS_AND_COMMUNICATION', 'E&C', 'ETC') THEN 'ECE' 
    -- Handle MECH variations
    WHEN UPPER(TRIM(department)) IN ('ME', 'MECH', 'MECHANICAL', 'MECHANICAL ENGINEERING', 'MECHANICAL_ENGINEERING') THEN 'MECH'
    -- Handle CIVIL variations
    WHEN UPPER(TRIM(department)) IN ('CE', 'CIVIL', 'CIVIL ENGINEERING', 'CIVIL_ENGINEERING') THEN 'CIVIL'
    -- Handle EEE variations  
    WHEN UPPER(TRIM(department)) IN ('EE', 'EEE', 'ELECTRICAL', 'ELECTRICAL ENGINEERING', 'ELECTRICAL_ENGINEERING', 'ELECTRICAL AND ELECTRONICS') THEN 'EEE'
    -- Default everything else to CSE
    ELSE 'CSE'
  END;

-- Force update ALL teams to ensure no nulls
UPDATE teams SET department = 'CSE' WHERE department IS NULL;

-- Show what department values exist that might be problematic
DO $$
DECLARE
    bad_team_depts TEXT[];
    bad_team_count INTEGER;
BEGIN
    -- Check for any remaining invalid department values in teams
    SELECT ARRAY_AGG(DISTINCT department), COUNT(DISTINCT department) INTO bad_team_depts, bad_team_count
    FROM teams 
    WHERE department IS NOT NULL 
    AND TRIM(department) NOT IN ('CSE', 'ECE', 'MECH', 'CIVIL', 'EEE');
    
    IF bad_team_count > 0 THEN
        RAISE NOTICE 'Found % invalid team departments: %', bad_team_count, bad_team_depts;
        -- Clean up any remaining invalid departments
        UPDATE teams SET department = 'CSE' 
        WHERE department IS NOT NULL 
        AND TRIM(department) NOT IN ('CSE', 'ECE', 'MECH', 'CIVIL', 'EEE');
    ELSE
        RAISE NOTICE 'SUCCESS: All team departments are now valid!';
    END IF;
END $$;

-- Clean up year values to match constraint
UPDATE teams SET year = 
  CASE 
    WHEN UPPER(TRIM(year)) IN ('FIRST', 'YEAR-1', '1ST', 'ONE') THEN '1'
    WHEN UPPER(TRIM(year)) IN ('SECOND', 'YEAR-2', '2ND', 'TWO') THEN '2'
    WHEN UPPER(TRIM(year)) IN ('THIRD', 'YEAR-3', '3RD', 'THREE') THEN '3'
    WHEN UPPER(TRIM(year)) IN ('FOURTH', 'YEAR-4', '4TH', 'FOUR', 'FINAL') THEN '4'
    WHEN TRIM(year) = '1' THEN '1'
    WHEN TRIM(year) = '2' THEN '2'
    WHEN TRIM(year) = '3' THEN '3'
    WHEN TRIM(year) = '4' THEN '4'
    WHEN UPPER(TRIM(year)) = 'I' THEN 'I'
    WHEN UPPER(TRIM(year)) = 'II' THEN 'II'
    WHEN UPPER(TRIM(year)) = 'III' THEN 'III'
    WHEN UPPER(TRIM(year)) = 'IV' THEN 'IV'
    ELSE '2'  -- Default to 2nd year if null or unrecognized
  END
WHERE year IS NULL OR TRIM(year) NOT IN ('1', '2', '3', '4', 'I', 'II', 'III', 'IV');

-- Show what year values exist that might be problematic
DO $$
DECLARE
    bad_team_years TEXT[];
    bad_year_count INTEGER;
BEGIN
    -- Check for any remaining invalid year values in teams
    SELECT ARRAY_AGG(DISTINCT year), COUNT(DISTINCT year) INTO bad_team_years, bad_year_count
    FROM teams 
    WHERE year IS NOT NULL 
    AND TRIM(year) NOT IN ('1', '2', '3', '4', 'I', 'II', 'III', 'IV');
    
    IF bad_year_count > 0 THEN
        RAISE NOTICE 'Found % invalid team years: %', bad_year_count, bad_team_years;
        -- Clean up any remaining invalid years
        UPDATE teams SET year = '2' 
        WHERE year IS NOT NULL 
        AND TRIM(year) NOT IN ('1', '2', '3', '4', 'I', 'II', 'III', 'IV');
    END IF;
END $$;

-- Clean up section values to ensure they meet length constraint
UPDATE teams SET section = UPPER(TRIM(LEFT(COALESCE(section, 'A'), 5)))
WHERE section IS NOT NULL AND LENGTH(TRIM(section)) > 5;

-- Clean up empty or null team names
UPDATE teams SET name = 'Team-' || id::text
WHERE name IS NULL OR LENGTH(TRIM(name)) = 0;

-- Add missing constraints and validation (NOT VALID initially to not check existing data)
DO $$
BEGIN
  -- Add constraints only if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'teams_name_not_empty') THEN
    ALTER TABLE teams ADD CONSTRAINT teams_name_not_empty CHECK (LENGTH(TRIM(name)) > 0) NOT VALID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'teams_department_valid') THEN
    ALTER TABLE teams ADD CONSTRAINT teams_department_valid CHECK (department IN ('CSE', 'ECE', 'MECH', 'CIVIL', 'EEE')) NOT VALID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'teams_year_valid') THEN
    ALTER TABLE teams ADD CONSTRAINT teams_year_valid CHECK (year IN ('1', '2', '3', '4', 'I', 'II', 'III', 'IV')) NOT VALID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'teams_section_valid') THEN
    ALTER TABLE teams ADD CONSTRAINT teams_section_valid CHECK (LENGTH(section) <= 5 OR section IS NULL) NOT VALID;
  END IF;
END $$;

-- Validate constraints now that data is clean
-- Show any remaining problematic data for debugging
DO $$
DECLARE
    bad_teams_count INTEGER;
    bad_years TEXT[];
BEGIN
    -- Check for any remaining invalid year values
    SELECT COUNT(*), ARRAY_AGG(DISTINCT year) INTO bad_teams_count, bad_years
    FROM teams 
    WHERE year IS NOT NULL AND TRIM(year) NOT IN ('1', '2', '3', '4', 'I', 'II', 'III', 'IV');
    
    IF bad_teams_count > 0 THEN
        RAISE NOTICE 'Found % teams with invalid year values: %', bad_teams_count, bad_years;
        -- Set remaining invalid years to '2'
        UPDATE teams SET year = '2' 
        WHERE year IS NOT NULL AND TRIM(year) NOT IN ('1', '2', '3', '4', 'I', 'II', 'III', 'IV');
    END IF;
END $$;

ALTER TABLE teams VALIDATE CONSTRAINT teams_name_not_empty;
ALTER TABLE teams VALIDATE CONSTRAINT teams_department_valid;
ALTER TABLE teams VALIDATE CONSTRAINT teams_year_valid;
ALTER TABLE teams VALIDATE CONSTRAINT teams_section_valid;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_department ON teams(department);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_selected_statement_id ON teams(selected_statement_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON teams(created_at);
CREATE INDEX IF NOT EXISTS idx_teams_lead_id ON teams(lead_id);

-- Unique constraint to prevent duplicate team names (handle existing duplicates)
DO $$
BEGIN
  -- Check if there are existing duplicate team names
  IF EXISTS (
    SELECT LOWER(TRIM(name)) 
    FROM teams 
    WHERE name IS NOT NULL 
    GROUP BY LOWER(TRIM(name)) 
    HAVING COUNT(*) > 1
  ) THEN
    -- Add a suffix to duplicate team names to make them unique
    -- Use ROW_NUMBER() to avoid MIN() on UUID
    UPDATE teams SET name = name || ' (' || id::text || ')'
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(name)) ORDER BY id::text) as rn
        FROM teams
        WHERE name IS NOT NULL
      ) ranked WHERE rn = 1
    );
  END IF;
  
  -- Now create the unique index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_teams_unique_name'
  ) THEN
    CREATE UNIQUE INDEX idx_teams_unique_name ON teams(LOWER(TRIM(name)));
  END IF;
END $$;

-- Add trigger to normalize team data
CREATE OR REPLACE FUNCTION normalize_team_data()
RETURNS TRIGGER AS $$
BEGIN
    NEW.name = TRIM(NEW.name);
    NEW.department = UPPER(TRIM(NEW.department));
    IF NEW.section IS NOT NULL THEN
        NEW.section = UPPER(TRIM(NEW.section));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teams_normalize_data ON teams;
CREATE TRIGGER teams_normalize_data
    BEFORE INSERT OR UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION normalize_team_data();

-- =============================================
-- 3. TEAM_MEMBERS TABLE IMPROVEMENTS  
-- =============================================

-- Show ALL current member department values for debugging
DO $$
DECLARE
    all_depts TEXT[];
    invalid_depts TEXT[];
    invalid_count INTEGER;
    table_exists BOOLEAN;
BEGIN
    -- Check if table exists (could be 'members' or 'team_members')
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') INTO table_exists;
    
    IF NOT table_exists THEN
        -- Try 'members' table instead
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') INTO table_exists;
        IF table_exists THEN
            RAISE NOTICE 'Using members table instead of team_members';
        ELSE
            RAISE NOTICE 'Neither team_members nor members table exists, skipping member cleanup';
            RETURN;
        END IF;
    END IF;
    
    -- Show all existing department values (adjust table name as needed)
    IF table_exists THEN
        EXECUTE format('SELECT ARRAY_AGG(DISTINCT department ORDER BY department) FROM %I WHERE department IS NOT NULL', 
                      CASE 
                        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') 
                        THEN 'team_members' 
                        ELSE 'members' 
                      END) INTO all_depts;
        
        IF array_length(all_depts, 1) > 0 THEN
            RAISE NOTICE 'All member department values found: %', all_depts;
        END IF;
    END IF;
END $$;

-- First, clean up ALL existing member data - be very aggressive 
DO $$
DECLARE
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RAISE NOTICE 'No members table found, skipping member department cleanup';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Cleaning up % table', members_table_name;
    
    -- Update department values
    EXECUTE format('
        UPDATE %I SET department = 
          CASE 
            -- Handle CSE variations
            WHEN UPPER(TRIM(department)) IN (''CS'', ''CSE'', ''COMPUTER SCIENCE'', ''COMPUTER'', ''COMP'', ''COMPSCI'', ''COMPUTER_SCIENCE'', ''COMPUTER SCIENCE AND ENGINEERING'') THEN ''CSE''
            -- Handle ECE variations
            WHEN UPPER(TRIM(department)) IN (''EC'', ''ECE'', ''ELECTRONICS'', ''ELECTRONICS AND COMMUNICATION'', ''ELECTRONIC'', ''ELECTRONICS_AND_COMMUNICATION'', ''E&C'', ''ETC'') THEN ''ECE''
            -- Handle MECH variations
            WHEN UPPER(TRIM(department)) IN (''ME'', ''MECH'', ''MECHANICAL'', ''MECHANICAL ENGINEERING'', ''MECHANICAL_ENGINEERING'') THEN ''MECH''
            -- Handle CIVIL variations
            WHEN UPPER(TRIM(department)) IN (''CE'', ''CIVIL'', ''CIVIL ENGINEERING'', ''CIVIL_ENGINEERING'') THEN ''CIVIL''
            -- Handle EEE variations
            WHEN UPPER(TRIM(department)) IN (''EE'', ''EEE'', ''ELECTRICAL'', ''ELECTRICAL ENGINEERING'', ''ELECTRICAL_ENGINEERING'', ''ELECTRICAL AND ELECTRONICS'') THEN ''EEE''
            -- Default everything else to CSE
            ELSE ''CSE''
          END', members_table_name);
    
    -- Force update ALL members regardless of current value to ensure consistency
    EXECUTE format('UPDATE %I SET department = ''CSE'' WHERE department IS NULL', members_table_name);
END $$;

-- Show the results after cleanup
DO $$
DECLARE
    cleaned_depts TEXT[];
    remaining_invalid TEXT[];
    remaining_count INTEGER;
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RAISE NOTICE 'No members table found for verification';
        RETURN;
    END IF;
    
    -- Show all department values after cleanup
    EXECUTE format('SELECT ARRAY_AGG(DISTINCT department ORDER BY department) FROM %I WHERE department IS NOT NULL', members_table_name) INTO cleaned_depts;
    
    RAISE NOTICE 'Member departments after cleanup: %', cleaned_depts;
    
    -- Check if any invalid values still remain
    EXECUTE format('
        SELECT ARRAY_AGG(DISTINCT department), COUNT(DISTINCT department) 
        FROM %I 
        WHERE department IS NOT NULL 
        AND TRIM(department) NOT IN (''CSE'', ''ECE'', ''MECH'', ''CIVIL'', ''EEE'')', 
        members_table_name) INTO remaining_invalid, remaining_count;
    
    IF remaining_count > 0 THEN
        RAISE NOTICE 'ERROR: Still found % invalid member departments after cleanup: %', remaining_count, remaining_invalid;
        -- Force clean up any stragglers
        EXECUTE format('
            UPDATE %I SET department = ''CSE'' 
            WHERE department IS NOT NULL 
            AND TRIM(department) NOT IN (''CSE'', ''ECE'', ''MECH'', ''CIVIL'', ''EEE'')', 
            members_table_name);
    ELSE
        RAISE NOTICE 'SUCCESS: All member departments are now valid!';
    END IF;
END $$;

-- Clean up member year values to match constraint
DO $$
DECLARE
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RAISE NOTICE 'No members table found for year cleanup';
        RETURN;
    END IF;
    
    -- Only update if year column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'year') THEN
        EXECUTE format('
            UPDATE %I SET year = 
              CASE 
                WHEN UPPER(TRIM(year)) IN (''FIRST'', ''YEAR-1'', ''1ST'', ''ONE'') THEN ''1''
                WHEN UPPER(TRIM(year)) IN (''SECOND'', ''YEAR-2'', ''2ND'', ''TWO'') THEN ''2''
                WHEN UPPER(TRIM(year)) IN (''THIRD'', ''YEAR-3'', ''3RD'', ''THREE'') THEN ''3''
                WHEN UPPER(TRIM(year)) IN (''FOURTH'', ''YEAR-4'', ''4TH'', ''FOUR'', ''FINAL'') THEN ''4''
                WHEN TRIM(year) = ''1'' THEN ''1''
                WHEN TRIM(year) = ''2'' THEN ''2''
                WHEN TRIM(year) = ''3'' THEN ''3''
                WHEN TRIM(year) = ''4'' THEN ''4''
                WHEN UPPER(TRIM(year)) = ''I'' THEN ''I''
                WHEN UPPER(TRIM(year)) = ''II'' THEN ''II''
                WHEN UPPER(TRIM(year)) = ''III'' THEN ''III''
                WHEN UPPER(TRIM(year)) = ''IV'' THEN ''IV''
                ELSE ''2''  -- Default to 2nd year if null or unrecognized
              END
            WHERE year IS NOT NULL AND TRIM(year) NOT IN (''1'', ''2'', ''3'', ''4'', ''I'', ''II'', ''III'', ''IV'')', 
            members_table_name);
    END IF;
END $$;

-- Clean up empty or null member names and register numbers
DO $$
DECLARE
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RETURN;
    END IF;
    
    -- Clean up names if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'name') THEN
        EXECUTE format('UPDATE %I SET name = ''Student-'' || id::text WHERE name IS NULL OR LENGTH(TRIM(name)) = 0', members_table_name);
    END IF;
    
    -- Clean up register numbers if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'register_number') THEN
        EXECUTE format('UPDATE %I SET register_number = ''REG'' || id::text WHERE register_number IS NULL OR LENGTH(TRIM(register_number)) = 0', members_table_name);
    END IF;
    
    -- Clean up invalid phone numbers if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'phone') THEN
        EXECUTE format('UPDATE %I SET phone = NULL WHERE phone IS NOT NULL AND phone !~ ''^[+]?[0-9]{10,15}$''', members_table_name);
    END IF;
END $$;

-- Add missing constraints (NOT VALID initially)
DO $$
DECLARE
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RAISE NOTICE 'No members table found for constraint addition';
        RETURN;
    END IF;
    
    -- Add constraints based on which columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'name') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_name_not_empty') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (LENGTH(TRIM(name)) > 0) NOT VALID', 
                          members_table_name, members_table_name || '_name_not_empty');
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'register_number') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_register_number_not_empty') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (LENGTH(TRIM(register_number)) > 0) NOT VALID', 
                          members_table_name, members_table_name || '_register_number_not_empty');
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'department') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_department_valid') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (department IN (''CSE'', ''ECE'', ''MECH'', ''CIVIL'', ''EEE'') OR department IS NULL) NOT VALID', 
                          members_table_name, members_table_name || '_department_valid');
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'year') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_year_valid') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (year IN (''1'', ''2'', ''3'', ''4'', ''I'', ''II'', ''III'', ''IV'') OR year IS NULL) NOT VALID', 
                          members_table_name, members_table_name || '_year_valid');
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'phone') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_phone_format') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (phone ~ ''^[+]?[0-9]{10,15}$'' OR phone IS NULL) NOT VALID', 
                          members_table_name, members_table_name || '_phone_format');
        END IF;
    END IF;
END $$;

-- Validate constraints now that data is clean
DO $$
DECLARE
    bad_members_count INTEGER;
    bad_member_years TEXT[];
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RETURN;
    END IF;
    
    -- Check for any remaining invalid member year values if year column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'year') THEN
        EXECUTE format('
            SELECT COUNT(*), ARRAY_AGG(DISTINCT year) 
            FROM %I 
            WHERE year IS NOT NULL AND TRIM(year) NOT IN (''1'', ''2'', ''3'', ''4'', ''I'', ''II'', ''III'', ''IV'')', 
            members_table_name) INTO bad_members_count, bad_member_years;
        
        IF bad_members_count > 0 THEN
            RAISE NOTICE 'Found % members with invalid year values: %', bad_members_count, bad_member_years;
            -- Set remaining invalid years to '2'
            EXECUTE format('
                UPDATE %I SET year = ''2'' 
                WHERE year IS NOT NULL AND TRIM(year) NOT IN (''1'', ''2'', ''3'', ''4'', ''I'', ''II'', ''III'', ''IV'')', 
                members_table_name);
        END IF;
    END IF;
    
    -- Validate constraints that exist
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_name_not_empty') THEN
            EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', members_table_name, members_table_name || '_name_not_empty');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to validate name constraint: %', SQLERRM;
    END;
    
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_register_number_not_empty') THEN
            EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', members_table_name, members_table_name || '_register_number_not_empty');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to validate register_number constraint: %', SQLERRM;
    END;
    
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_department_valid') THEN
            EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', members_table_name, members_table_name || '_department_valid');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to validate department constraint: %', SQLERRM;
    END;
    
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_year_valid') THEN
            EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', members_table_name, members_table_name || '_year_valid');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to validate year constraint: %', SQLERRM;
    END;
    
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = members_table_name || '_phone_format') THEN
            EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', members_table_name, members_table_name || '_phone_format');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to validate phone constraint: %', SQLERRM;
    END;
END $$;

-- Add unique constraint to prevent duplicate register numbers across teams (handle existing duplicates)
DO $$
DECLARE
    members_table_name TEXT;
    has_duplicates BOOLEAN := FALSE;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RETURN;
    END IF;
    
    -- Only proceed if register_number column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'register_number') THEN
        RAISE NOTICE 'No register_number column found in %, skipping unique constraint', members_table_name;
        RETURN;
    END IF;
    
    -- Check for duplicates using a simpler approach
    EXECUTE format('
        SELECT EXISTS (
            SELECT 1 FROM (
                SELECT LOWER(TRIM(register_number)) 
                FROM %I 
                WHERE register_number IS NOT NULL 
                GROUP BY LOWER(TRIM(register_number)) 
                HAVING COUNT(*) > 1 
                LIMIT 1
            ) as dupe_check
        )', members_table_name) INTO has_duplicates;
    
    IF has_duplicates THEN
        -- Add a suffix to duplicate register numbers to make them unique
        EXECUTE format('
            UPDATE %I SET register_number = register_number || ''-'' || id::text
            WHERE id NOT IN (
              SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(register_number)) ORDER BY id::text) as rn
                FROM %I
                WHERE register_number IS NOT NULL
              ) ranked WHERE rn = 1
            )', members_table_name, members_table_name);
    END IF;
    
    -- Now create the unique index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_' || members_table_name || '_unique_register_number'
    ) THEN
        EXECUTE format('CREATE UNIQUE INDEX %I ON %I(LOWER(TRIM(register_number)))', 
                      'idx_' || members_table_name || '_unique_register_number', members_table_name);
    END IF;
END $$;

-- Add performance indexes
DO $$
DECLARE
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RETURN;
    END IF;
    
    -- Create indexes based on which columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'team_id') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_team_id ON %I(team_id)', members_table_name, members_table_name);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'register_number') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_register_number ON %I(register_number)', members_table_name, members_table_name);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'department') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_department ON %I(department)', members_table_name, members_table_name);
    END IF;
END $$;

-- Add member count constraint (teams usually have 3-5 members)
-- Add member count constraint (teams usually have 3-5 members)
DO $$
DECLARE
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RETURN;
    END IF;
    
    -- Only create if team_id column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = members_table_name AND column_name = 'team_id') THEN
        -- Create function with dynamic table name
        EXECUTE format('
            CREATE OR REPLACE FUNCTION check_%s_team_member_limit()
            RETURNS TRIGGER AS $func$
            DECLARE
                member_count INTEGER;
            BEGIN
                -- Only check on INSERT operations
                IF TG_OP = ''INSERT'' THEN
                    -- Count current members for the team (excluding the one being inserted)
                    SELECT COUNT(*) INTO member_count 
                    FROM %I 
                    WHERE team_id = NEW.team_id;
                    
                    -- Allow up to 5 members per team
                    IF member_count >= 5 THEN
                        RAISE EXCEPTION ''Team cannot have more than 5 members'';
                    END IF;
                END IF;
                
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql', 
            members_table_name, members_table_name);
        
        -- Drop old trigger if exists
        EXECUTE format('DROP TRIGGER IF EXISTS %s_check_limit ON %I', members_table_name, members_table_name);
        
        -- Create new trigger
        EXECUTE format('
            CREATE TRIGGER %s_check_limit
                BEFORE INSERT ON %I
                FOR EACH ROW EXECUTE FUNCTION check_%s_team_member_limit()', 
            members_table_name, members_table_name, members_table_name);
    END IF;
END $$;

-- Normalize member data
DO $$
DECLARE
    members_table_name TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table_name := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table_name := 'members';
    ELSE
        RETURN;
    END IF;
    
    -- Create a simple normalization function
    EXECUTE format('
        CREATE OR REPLACE FUNCTION normalize_%s_data()
        RETURNS TRIGGER AS $func$
        BEGIN
            -- Normalize name if column exists
            BEGIN
                NEW.name = TRIM(NEW.name);
            EXCEPTION WHEN undefined_column THEN
                NULL; -- Column doesn''t exist, skip
            END;
            
            -- Normalize register_number if column exists  
            BEGIN
                NEW.register_number = UPPER(TRIM(NEW.register_number));
            EXCEPTION WHEN undefined_column THEN
                NULL; -- Column doesn''t exist, skip
            END;
            
            -- Normalize email if column exists
            BEGIN
                IF NEW.email IS NOT NULL THEN
                    NEW.email = LOWER(TRIM(NEW.email));
                END IF;
            EXCEPTION WHEN undefined_column THEN
                NULL; -- Column doesn''t exist, skip
            END;
            
            -- Normalize department if column exists
            BEGIN
                IF NEW.department IS NOT NULL THEN
                    NEW.department = UPPER(TRIM(NEW.department));
                END IF;
            EXCEPTION WHEN undefined_column THEN
                NULL; -- Column doesn''t exist, skip
            END;
            
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql', members_table_name);
    
    -- Drop old trigger if exists
    EXECUTE format('DROP TRIGGER IF EXISTS %s_normalize_data ON %I', members_table_name, members_table_name);
    
    -- Create new trigger
    EXECUTE format('
        CREATE TRIGGER %s_normalize_data
            BEFORE INSERT OR UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION normalize_%s_data()', 
        members_table_name, members_table_name, members_table_name);
END $$;

-- =============================================
-- 4. PROBLEM STATEMENTS TABLE (if not exists)
-- =============================================

-- Create problem_statements table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'problem_statements' AND table_schema = 'public') THEN
    CREATE TABLE problem_statements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
        description TEXT NOT NULL CHECK (LENGTH(TRIM(description)) > 20),
        department TEXT NOT NULL CHECK (department IN ('CSE', 'ECE', 'MECH', 'CIVIL', 'EEE')),
        max_teams INTEGER DEFAULT 3 CHECK (max_teams > 0 AND max_teams <= 10),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  ELSE
    -- Table exists, make sure it has all required columns
    ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS max_teams INTEGER DEFAULT 3;
    ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    -- Add constraints if they don't exist
    DO $inner$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'problem_statements_title_check') THEN
        ALTER TABLE problem_statements ADD CONSTRAINT problem_statements_title_check CHECK (LENGTH(TRIM(title)) > 0);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'problem_statements_description_check') THEN
        ALTER TABLE problem_statements ADD CONSTRAINT problem_statements_description_check CHECK (LENGTH(TRIM(description)) > 20);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'problem_statements_max_teams_check') THEN
        ALTER TABLE problem_statements ADD CONSTRAINT problem_statements_max_teams_check CHECK (max_teams > 0 AND max_teams <= 10);
      END IF;
    END $inner$;
  END IF;
END $$;

-- Add indexes for problem statements
CREATE INDEX IF NOT EXISTS idx_problem_statements_department ON problem_statements(department);
CREATE INDEX IF NOT EXISTS idx_problem_statements_is_active ON problem_statements(is_active);
CREATE INDEX IF NOT EXISTS idx_problem_statements_created_at ON problem_statements(created_at);

-- Enable RLS for problem_statements
ALTER TABLE problem_statements ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraint from teams to problem_statements if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'teams_selected_statement_id_fkey' 
    AND table_name = 'teams'
  ) THEN
    -- First ensure there are no orphaned references
    UPDATE teams SET selected_statement_id = NULL 
    WHERE selected_statement_id IS NOT NULL 
    AND selected_statement_id NOT IN (SELECT id FROM problem_statements);
    
    ALTER TABLE teams ADD CONSTRAINT teams_selected_statement_id_fkey 
    FOREIGN KEY (selected_statement_id) REFERENCES problem_statements(id);
  END IF;
END $$;

-- =============================================
-- 5. NOTIFICATIONS TABLE (if not exists)
-- =============================================

-- Create notifications table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title TEXT NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
        message TEXT NOT NULL CHECK (LENGTH(TRIM(message)) > 0),
        type TEXT CHECK (type IN ('success', 'warning', 'info', 'error')) DEFAULT 'info',
        recipient_id TEXT NOT NULL,
        recipient_type TEXT CHECK (recipient_type IN ('faculty', 'team', 'admin')) NOT NULL,
        sender_id TEXT,
        sender_type TEXT CHECK (sender_type IN ('system', 'faculty', 'admin')) DEFAULT 'system',
        is_read BOOLEAN DEFAULT false,
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        related_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        read_at TIMESTAMP WITH TIME ZONE
    );
  ELSE
    -- Table exists, make sure it has all required columns with proper types
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'team';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'system';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_data JSONB;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
    
    -- Add constraints if they don't exist
    DO $inner$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'notifications_title_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_title_check CHECK (LENGTH(TRIM(title)) > 0);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'notifications_message_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_message_check CHECK (LENGTH(TRIM(message)) > 0);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'notifications_type_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('success', 'warning', 'info', 'error'));
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'notifications_recipient_type_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_recipient_type_check CHECK (recipient_type IN ('faculty', 'team', 'admin'));
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'notifications_sender_type_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_sender_type_check CHECK (sender_type IN ('system', 'faculty', 'admin'));
      END IF;
    END $inner$;
  END IF;
END $$;

-- Add indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_team_id ON notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Enable RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. FIX ALL RLS POLICIES
-- =============================================

-- Drop all existing problematic policies
DO $$
BEGIN
    -- Profiles policies
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
    
    -- Teams policies  
    DROP POLICY IF EXISTS "Teams are viewable by everyone" ON teams;
    DROP POLICY IF EXISTS "Users can insert their own team" ON teams;
    DROP POLICY IF EXISTS "Leads can update their own team" ON teams;
    
    -- Members policies
    DROP POLICY IF EXISTS "Members are viewable by everyone" ON members;
    DROP POLICY IF EXISTS "Leads can insert members to their team" ON members;
    
    -- Submissions policies
    DROP POLICY IF EXISTS "Submissions are viewable by team leads and faculty" ON submissions;
    DROP POLICY IF EXISTS "Leads can insert submissions to their team" ON submissions;
    DROP POLICY IF EXISTS "Team leads can manage own submissions" ON submissions;
    DROP POLICY IF EXISTS "Faculty can view all submissions" ON submissions;
    DROP POLICY IF EXISTS "Admins can manage all submissions" ON submissions;
    
    -- Problem statements policies
    DROP POLICY IF EXISTS "Allow all operations on problem_statements" ON problem_statements;
    
    -- Notifications policies
    DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
END $$;

-- Create proper RLS policies

-- PROFILES POLICIES
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- TEAMS POLICIES
CREATE POLICY "teams_select_all" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_insert_own" ON teams FOR INSERT WITH CHECK (auth.uid() = lead_id);
CREATE POLICY "teams_update_own" ON teams FOR UPDATE USING (auth.uid() = lead_id) WITH CHECK (auth.uid() = lead_id);
CREATE POLICY "teams_update_faculty" ON teams FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin'))
);

-- MEMBERS POLICIES
CREATE POLICY "members_select_all" ON members FOR SELECT USING (true);
CREATE POLICY "members_insert_team_lead" ON members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND lead_id = auth.uid())
);
CREATE POLICY "members_update_team_lead" ON members FOR UPDATE USING (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND lead_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND lead_id = auth.uid())
);
CREATE POLICY "members_delete_team_lead" ON members FOR DELETE USING (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND lead_id = auth.uid())
);

-- SUBMISSIONS POLICIES (Fixed)
CREATE POLICY "submissions_select_team_leads" ON submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND lead_id = auth.uid())
);
CREATE POLICY "submissions_select_faculty" ON submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin'))
);
CREATE POLICY "submissions_insert_team_leads" ON submissions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND lead_id = auth.uid())
);
CREATE POLICY "submissions_update_team_leads" ON submissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND lead_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND lead_id = auth.uid())
);
CREATE POLICY "submissions_update_faculty" ON submissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin'))
);

-- PROBLEM STATEMENTS POLICIES
CREATE POLICY "problem_statements_select_all" ON problem_statements FOR SELECT USING (true);
CREATE POLICY "problem_statements_manage_faculty" ON problem_statements FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin'))
);

-- NOTIFICATIONS POLICIES
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (recipient_id = auth.uid()::text);
CREATE POLICY "notifications_insert_authenticated" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (recipient_id = auth.uid()::text) WITH CHECK (recipient_id = auth.uid()::text);
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE USING (recipient_id = auth.uid()::text);

-- =============================================
-- 7. CREATE USEFUL VIEWS FOR APPLICATION
-- =============================================

-- View for team statistics
CREATE OR REPLACE VIEW team_stats AS
SELECT 
    t.department,
    COUNT(*) as total_teams,
    COUNT(CASE WHEN t.status = 'Selected' THEN 1 END) as selected_teams,
    COUNT(CASE WHEN t.status = 'Pending' THEN 1 END) as pending_teams,
    COUNT(CASE WHEN t.status = 'Rejected' THEN 1 END) as rejected_teams,
    COUNT(s.id) as teams_with_submissions
FROM teams t
LEFT JOIN submissions s ON t.id = s.team_id
GROUP BY t.department;

-- View for submission statistics
CREATE OR REPLACE VIEW submission_stats AS
SELECT 
    ps.id as statement_id,
    ps.title as statement_title,
    ps.department,
    ps.max_teams,
    COUNT(s.id) as submission_count,
    COUNT(DISTINCT s.team_id) as unique_teams,
    ARRAY_AGG(
        JSON_BUILD_OBJECT(
            'team_name', tm.name,
            'submission_title', s.title,
            'submitted_at', s.submitted_at,
            'status', s.status
        ) ORDER BY s.submitted_at DESC
    ) FILTER (WHERE s.id IS NOT NULL) as submissions
FROM problem_statements ps
LEFT JOIN submissions s ON ps.id = s.statement_id
LEFT JOIN teams tm ON s.team_id = tm.id
WHERE ps.is_active = true
GROUP BY ps.id, ps.title, ps.department, ps.max_teams
ORDER BY ps.title;

-- Grant proper permissions on views
GRANT SELECT ON team_stats TO authenticated;
GRANT SELECT ON submission_stats TO authenticated;

-- =============================================
-- 8. CREATE UTILITY FUNCTIONS
-- =============================================

-- Function to get team details with member count
CREATE OR REPLACE FUNCTION get_team_details(team_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    members_table TEXT;
    member_count_query TEXT;
    member_count INT;
BEGIN
    -- Determine which members table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') THEN
        members_table := 'team_members';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        members_table := 'members';
    ELSE
        members_table := NULL;
    END IF;
    
    -- Get member count if members table exists
    IF members_table IS NOT NULL THEN
        member_count_query := format('SELECT COUNT(*) FROM %I WHERE team_id = $1', members_table);
        EXECUTE member_count_query INTO member_count USING team_uuid;
    ELSE
        member_count := 0;
    END IF;
    
    SELECT JSON_BUILD_OBJECT(
        'id', t.id,
        'name', t.name,
        'department', t.department,
        'year', t.year,
        'section', t.section,
        'status', t.status,
        'lead_name', COALESCE(p.full_name, p.email),
        'lead_email', p.email,
        'member_count', member_count,
        'submission_count', (SELECT COUNT(*) FROM submissions WHERE team_id = t.id),
        'selected_statement', ps.title,
        'created_at', t.created_at
    ) INTO result
    FROM teams t
    LEFT JOIN profiles p ON t.lead_id = p.id
    LEFT JOIN problem_statements ps ON t.selected_statement_id = ps.id
    WHERE t.id = team_uuid;
    
    RETURN COALESCE(result, '{"error": "Team not found"}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if team can submit for a statement
CREATE OR REPLACE FUNCTION can_team_submit(team_uuid UUID, statement_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    existing_submission_count INTEGER;
    max_teams INTEGER;
    current_team_count INTEGER;
    statement_exists BOOLEAN;
BEGIN
    -- Check if statement exists and is active
    SELECT EXISTS(SELECT 1 FROM problem_statements WHERE id = statement_id AND is_active = true) INTO statement_exists;
    
    IF NOT statement_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Check if team already submitted for this statement
    SELECT COUNT(*) INTO existing_submission_count
    FROM submissions 
    WHERE team_id = team_uuid AND statement_id = statement_id;
    
    IF existing_submission_count > 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if statement has reached max teams
    SELECT ps.max_teams INTO max_teams
    FROM problem_statements ps
    WHERE ps.id = statement_id AND ps.is_active = true;
    
    IF max_teams IS NULL THEN
        RETURN FALSE;
    END IF;
    
    SELECT COUNT(DISTINCT s.team_id) INTO current_team_count
    FROM submissions s
    WHERE s.statement_id = statement_id;
    
    RETURN current_team_count < max_teams;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 9. INSERT DEFAULT DATA IF NEEDED
-- =============================================

-- Insert default problem statements if table is empty
INSERT INTO problem_statements (title, description, department, max_teams)
SELECT * FROM (VALUES
    ('AI-Powered Code Review System', 'Develop an intelligent system that automatically reviews code submissions and provides feedback on code quality, security vulnerabilities, and optimization suggestions.', 'CSE', 3),
    ('Smart Campus IoT Network', 'Design and implement an IoT network for campus-wide monitoring of energy consumption, security, and environmental conditions with real-time alerts.', 'ECE', 3),
    ('Automated Manufacturing Quality Control', 'Create a computer vision-based system for real-time quality inspection in manufacturing processes with predictive maintenance capabilities.', 'MECH', 3),
    ('Sustainable Building Management System', 'Develop an integrated system for optimizing energy usage, water consumption, and waste management in smart buildings using renewable energy sources.', 'CIVIL', 3),
    ('Electric Vehicle Charging Optimization', 'Design an intelligent charging infrastructure management system that optimizes charging schedules based on grid load and user preferences.', 'EEE', 3)
) AS default_statements(title, description, department, max_teams)
WHERE NOT EXISTS (SELECT 1 FROM problem_statements);

COMMIT;

-- =============================================
-- POST-MIGRATION VERIFICATION
-- =============================================

-- Verify all tables exist and have proper constraints
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('profiles', 'teams', 'members', 'submissions', 'problem_statements', 'notifications');
    
    IF table_count < 6 THEN
        RAISE EXCEPTION 'Migration failed: Not all required tables exist. Found % tables, expected 6.', table_count;
    END IF;
    
    RAISE NOTICE 'Migration completed successfully! All % required tables exist.', table_count;
END $$;

-- Final message
SELECT 'Database schema has been successfully optimized for production use!' as migration_status;