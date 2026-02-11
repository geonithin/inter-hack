# Database Migration Instructions

Since psql and Supabase CLI are not available in this environment, here are the steps to run the database optimization migration:

## Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project (hnsvejzbmhtcamwamqey)
3. Go to the "SQL Editor" section
4. Click "New Query"
5. Copy the entire contents of `complete_database_optimization.sql` and paste it into the SQL editor
6. Click "Run" to execute the migration

## Option 2: Using a PostgreSQL Client

If you have any PostgreSQL client installed (like pgAdmin, DBeaver, or psql), you can connect using these credentials:

```
Host: aws-0-ap-south-1.pooler.supabase.com
Port: 5432
Database: postgres
User: postgres.hnsvejzbmhtcamwamqey
Password: cvz7ZzaD#HBxE!m
```

Then execute the `complete_database_optimization.sql` file.

## What the Migration Does

The migration script includes:

1. **Data Cleanup**: Normalizes existing data to meet constraints
   - Department values are standardized to valid options
   - Year values are normalized to valid formats
   - Member data is cleaned up similarly

2. **Enhanced Debugging**: Shows problematic data before cleanup
   - Displays invalid department values
   - Shows invalid year values  
   - Reports invalid member department values

3. **Constraint Addition**: Adds proper validation constraints
   - Teams department validation
   - Teams year validation
   - Members department validation
   - Plus indexes and RLS policies

4. **Error Recovery**: The script is designed to handle existing data gracefully by cleaning it up first

## Expected Output

During execution, you should see NOTICE messages like:
```
NOTICE: Found X invalid team departments: {...}
NOTICE: Found X invalid team years: {...}
NOTICE: Found X invalid member departments: {...}
```

These are normal and indicate the cleanup process is working.

## After Migration

Once the migration completes successfully:

1. Your database will have proper constraints to prevent invalid data
2. All existing data will be normalized to meet the constraints
3. RLS policies will be properly configured
4. The application should work without constraint violations

## Verification

You can run the test script `test_database_state.js` to verify the migration worked correctly.