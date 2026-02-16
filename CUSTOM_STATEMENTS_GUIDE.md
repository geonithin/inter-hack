# Custom Problem Statements Feature - Complete Guide

## 🎯 Overview

This feature allows teams to create and work on their own custom problem statements instead of being limited to pre-defined ones. Faculty can review and approve these custom statements before teams submit their solutions.

## 📋 Table of Contents

1. [Database Setup](#database-setup)
2. [Team Workflow](#team-workflow)
3. [Faculty Workflow](#faculty-workflow)
4. [Technical Architecture](#technical-architecture)
5. [Testing Guide](#testing-guide)
6. [Troubleshooting](#troubleshooting)

---

## 🗄️ Database Setup

### Step 1: Run the Production Setup Script

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `SETUP_CUSTOM_STATEMENTS.sql`
5. Paste and click **Run**

### Step 2: Verify Installation

Run these verification queries:

```sql
-- Check if table exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'custom_problem_statements'
);

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'custom_problem_statements';
```

**Expected Results:**
- Table exists: `true`
- Policies created: 3 policies (team leads, faculty view, faculty update)

---

## 👥 Team Workflow

### Creating a Custom Statement

1. **Login as Team Lead**
   - Navigate to your team dashboard
   - Look for the filter options at the top

2. **Access Own Statement**
   - Click on the **"Own Statement"** button in the filter tabs
   - This button appears next to "All Tracks"

3. **Create Your Statement**
   - Click **"Create Custom Statement"** button
   - Fill in the following fields:
     - **Department**: Select your department (CSE, AIDS, ECE, etc.)
     - **Problem Statement Title**: Enter a clear, concise title (max 200 characters)
     - **Problem Description**: Describe the problem in detail (minimum 20 characters)
   
4. **Submit for Review**
   - Review all details carefully
   - Click **"Create Statement"**
   - Your statement is now pending faculty approval

### Viewing Statement Status

After creating a custom statement, you'll see:

- **Pending** (⏳): Awaiting faculty review
- **Approved** (✓): Ready for solution submission
- **Rejected** (✗): Not approved (contact faculty for feedback)

### Submitting Solutions

Once your custom statement is **approved**:

1. Go to **"Own Statement"** tab
2. Click **"Submit Your Solution"** button
3. Fill in the submission form:
   - **Idea Title**: Your solution name
   - **Detailed Solution Overview**: Describe your approach
   - **Technology Stack**: Technologies you'll use (e.g., React, Node.js)
   - **External Links** (Optional): GitHub, Figma, or documentation links
4. Click **"Final Submission"**

**Important Notes:**
- ⚠️ You can only create **ONE** custom statement per team
- ⚠️ Once created, you **cannot modify** the statement
- ⚠️ Submission is only possible after faculty approval

---

## 🎓 Faculty Workflow

### Accessing Custom Statements

1. **Login to Faculty Dashboard**
2. Click on the **"Custom"** tab in the view toggle
   - Located between "Statements" and "Messages" tabs

### Reviewing Statements

The Custom Statements view shows:

| Column | Description |
|--------|-------------|
| **Team** | Team name and details (department, year, section) |
| **Title & Description** | Statement title and description preview |
| **Department** | Problem's department classification |
| **Status** | Current approval status (Pending/Approved/Rejected) |
| **Actions** | Approve/Reject buttons (for pending statements) |

### Approving or Rejecting

**For Pending Statements:**

1. **Review** the statement carefully:
   - Is the problem clear and well-defined?
   - Is it appropriate for the student's department and skill level?
   - Does it have educational value?

2. **Approve** ✓:
   - Click the green checkmark button
   - Team can now submit their solution

3. **Reject** ✗:
   - Click the red X button
   - Team will be notified to contact faculty for feedback

**Statistics Dashboard:**
- **Total Custom**: All custom statements created
- **Pending Review**: Statements awaiting approval
- **Approved**: Statements ready for submission

---

## 🏗️ Technical Architecture

### Database Schema

#### `custom_problem_statements` Table

```sql
CREATE TABLE custom_problem_statements (
    id uuid PRIMARY KEY,
    team_id uuid REFERENCES teams(id),
    title text NOT NULL,
    description text NOT NULL,
    department text NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamp,
    updated_at timestamp,
    CONSTRAINT unique_team_custom_statement UNIQUE (team_id)
);
```

#### `submissions` Table Updates

```sql
-- New column added
custom_statement_id uuid REFERENCES custom_problem_statements(id)

-- Constraint: Either statement_id OR custom_statement_id (not both)
CHECK (
    (statement_id IS NOT NULL AND custom_statement_id IS NULL) OR 
    (statement_id IS NULL AND custom_statement_id IS NOT NULL)
)
```

### Row Level Security (RLS)

**Team Leads:**
- Can create and view their own custom statements
- Can update only their own statements

**Faculty/Admin:**
- Can view all custom statements
- Can update status (approve/reject)
- Cannot delete statements

### Components Created

1. **`CustomStatementModal.jsx`**
   - Modal for creating custom statements
   - Form validation and submission
   - Notification integration

2. **Updated `Dashboard.jsx`**
   - Added "Own Statement" filter
   - Custom statement display and management
   - Integration with submission flow

3. **Updated `SubmissionForm.jsx`**
   - Handles both regular and custom statements
   - Determines which field to populate (statement_id vs custom_statement_id)

4. **Updated `FacultyDashboard.jsx`**
   - New "Custom" tab for reviewing statements
   - Approve/Reject functionality
   - Statistics for custom statements

---

## 🧪 Testing Guide

### Test Case 1: Create Custom Statement

**Steps:**
1. Login as team lead
2. Navigate to dashboard
3. Click "Own Statement" filter
4. Click "Create Custom Statement"
5. Fill in all required fields
6. Submit

**Expected Result:**
- Statement created with status "pending"
- Success notification shown
- Statement appears in Own Statement view

### Test Case 2: Prevent Duplicate Creation

**Steps:**
1. After creating one custom statement
2. Try to create another one

**Expected Result:**
- Error message: "Your team already has a custom problem statement"
- Modal prevents submission

### Test Case 3: Faculty Approval

**Steps:**
1. Login as faculty
2. Go to Custom Statements tab
3. Find pending statement
4. Click approve button

**Expected Result:**
- Status changes to "approved"
- Team is notified
- Statistics updated

### Test Case 4: Submit Solution for Custom Statement

**Steps:**
1. Login as team lead (with approved custom statement)
2. Go to Own Statement tab
3. Click "Submit Your Solution"
4. Fill in submission form
5. Submit

**Expected Result:**
- Submission created with custom_statement_id populated
- statement_id is null
- Submission visible in faculty dashboard

### Test Case 5: View Submissions

**Steps:**
1. Login as faculty
2. Check submissions for team with custom statement

**Expected Result:**
- Submission shows custom statement title
- Both regular and custom submissions are visible
- Proper differentiation between types

---

## 🔧 Troubleshooting

### Issue: "Table does not exist" Error

**Solution:**
```sql
-- Run the production setup script
-- File: SETUP_CUSTOM_STATEMENTS.sql
```

### Issue: Cannot Create Custom Statement

**Possible Causes:**
1. Already created one statement
2. RLS policies not set correctly
3. Not logged in as team lead

**Solution:**
```sql
-- Check existing statements
SELECT * FROM custom_problem_statements WHERE team_id = 'YOUR_TEAM_ID';

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'custom_problem_statements';
```

### Issue: Submissions Table Error

**Solution:**
```sql
-- Verify custom_statement_id column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'submissions' AND column_name = 'custom_statement_id';

-- If missing, run:
ALTER TABLE submissions 
ADD COLUMN custom_statement_id uuid REFERENCES custom_problem_statements(id);
```

### Issue: Faculty Cannot Approve/Reject

**Solution:**
```sql
-- Verify faculty role
SELECT id, email, role FROM profiles WHERE role IN ('faculty', 'admin');

-- Check RLS policy
DROP POLICY IF EXISTS "Faculty update custom statement status" ON custom_problem_statements;
CREATE POLICY "Faculty update custom statement status" 
ON custom_problem_statements FOR UPDATE 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('faculty', 'admin')));
```

---

## 📊 Feature Statistics

Use these queries to monitor usage:

```sql
-- Total custom statements by status
SELECT status, COUNT(*) as count 
FROM custom_problem_statements 
GROUP BY status;

-- Custom statements by department
SELECT department, COUNT(*) as count 
FROM custom_problem_statements 
GROUP BY department 
ORDER BY count DESC;

-- Teams using custom statements
SELECT 
    t.name as team_name,
    t.department,
    c.title as statement_title,
    c.status,
    c.created_at
FROM custom_problem_statements c
JOIN teams t ON c.team_id = t.id
ORDER BY c.created_at DESC;

-- Submissions for custom statements
SELECT 
    t.name as team_name,
    c.title as custom_statement,
    s.title as submission_title,
    s.submitted_at
FROM submissions s
JOIN custom_problem_statements c ON s.custom_statement_id = c.id
JOIN teams t ON s.team_id = t.id
ORDER BY s.submitted_at DESC;
```

---

## ✅ Production Checklist

Before deploying to production:

- [ ] Run `SETUP_CUSTOM_STATEMENTS.sql` in Supabase
- [ ] Verify all RLS policies are active
- [ ] Test create/approve/submit workflow
- [ ] Check faculty dashboard displays custom statements
- [ ] Verify notifications are working
- [ ] Test with multiple teams
- [ ] Ensure proper error handling
- [ ] Backup database before deployment
- [ ] Document any custom configurations
- [ ] Train faculty on approval process

---

## 🎓 Best Practices

### For Teams:
1. Be specific and clear in problem descriptions
2. Include why the problem is important
3. Mention expected outcomes
4. Choose appropriate department
5. Proofread before submitting (cannot edit after creation)

### For Faculty:
1. Review statements within 24-48 hours
2. Provide feedback for rejected statements
3. Ensure statements align with curriculum
4. Check for duplicate problems
5. Verify technical feasibility

---

## 📞 Support

For issues or questions:

1. Check this guide first
2. Review SQL migration files
3. Check Supabase logs for errors
4. Verify RLS policies are active
5. Contact system administrator

---

## 🔄 Updates & Maintenance

### Future Enhancements:
- [ ] Allow editing of pending statements
- [ ] Add faculty comments on rejection
- [ ] Email notifications for status changes
- [ ] Statement categories/tags
- [ ] Export custom statements report
- [ ] Statement templates

---

## 📝 Change Log

**Version 1.0.0** (February 16, 2026)
- Initial release
- Create custom statements
- Faculty approval workflow
- Integration with submission system
- Team dashboard updates
- Faculty dashboard updates

---

**End of Guide**
