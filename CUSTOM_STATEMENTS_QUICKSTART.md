# Custom Problem Statements - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Database Setup
```bash
1. Open Supabase Dashboard → SQL Editor
2. Run: SETUP_CUSTOM_STATEMENTS.sql
3. Verify: Check if custom_problem_statements table exists
```

### Step 2: Test the Feature

**As Team Lead:**
1. Login → Dashboard
2. Click **"Own Statement"** button (green, with + icon)
3. Click **"Create Custom Statement"**
4. Fill form and submit
5. Wait for faculty approval

**As Faculty:**
1. Login → Faculty Dashboard
2. Click **"Custom"** tab (green tab)
3. See pending statements
4. Click ✓ to approve or ✗ to reject

---

## 📸 UI Elements Added

### Team Dashboard
- **New Filter Button**: "Own Statement" (emerald green, next to "All Tracks")
- **Custom Statement View**: 
  - If no statement: Shows "Create Custom Statement" prompt
  - If pending: Shows status card with "⏳ Awaiting Faculty Approval"
  - If approved: Shows "Submit Your Solution" button

### Faculty Dashboard
- **New Tab**: "Custom" (between "Statements" and "Messages")
- **Custom Statements Table**: Shows all team submissions
- **Action Buttons**: Approve (✓) and Reject (✗) for pending statements

---

## 🗂️ Files Created/Modified

### New Files:
1. `src/components/CustomStatementModal.jsx` - Modal for creating statements
2. `supabase/migrations/20260216_custom_problem_statements.sql` - Database migration
3. `SETUP_CUSTOM_STATEMENTS.sql` - Production setup script
4. `CUSTOM_STATEMENTS_GUIDE.md` - Complete documentation

### Modified Files:
1. `src/pages/Dashboard.jsx` - Added Own Statement filter and view
2. `src/pages/FacultyDashboard.jsx` - Added Custom tab and approval interface
3. `src/components/SubmissionForm.jsx` - Updated to handle custom statements

---

## 🔑 Key Features

✅ Teams can create ONE custom problem statement
✅ Faculty review and approve before submission
✅ Same submission workflow as pre-defined statements
✅ Department filtering maintained
✅ RLS policies enforce proper access control
✅ Real-time status updates
✅ Notifications for faculty when statement is created

---

## ⚠️ Important Rules

1. **One Statement Per Team**: Cannot create multiple custom statements
2. **No Editing**: Once created, statement cannot be modified
3. **Faculty Approval Required**: Must be approved before submission
4. **Same Fields as Pre-defined**: Department, title, description required
5. **Submission After Approval**: Can only submit solution once approved

---

## 🎯 Field Requirements

### Custom Statement Form:
- **Department**: Required (dropdown)
- **Problem Statement Title**: Required, max 200 chars
- **Problem Description**: Required, min 20 chars

### Submission Form (Same as Pre-defined):
- **Idea Title**: Required
- **Detailed Solution Overview**: Required
- **Technology Stack**: Required
- **External Links**: Optional (GitHub, Figma, etc.)

---

## 📊 Database Structure

```
custom_problem_statements
├── id (uuid)
├── team_id (uuid → teams)
├── title (text)
├── description (text)
├── department (text)
├── status ('pending' | 'approved' | 'rejected')
├── created_at (timestamp)
└── updated_at (timestamp)

submissions (updated)
├── ... (existing fields)
├── statement_id (int | null)
└── custom_statement_id (uuid | null)
    ↑ Exactly one must be set
```

---

## 🧪 Quick Test

Run these SQL queries to verify setup:

```sql
-- 1. Check table exists
SELECT COUNT(*) FROM custom_problem_statements;

-- 2. Check policies
SELECT policyname FROM pg_policies 
WHERE tablename = 'custom_problem_statements';

-- 3. Check submissions column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND column_name = 'custom_statement_id';
```

Expected: All queries run without errors

---

## 🐛 Common Issues & Fixes

### Issue: "Own Statement" button not visible
**Fix:** Clear cache and refresh browser

### Issue: Cannot create statement (permission denied)
**Fix:** Verify you're logged in as team lead:
```sql
SELECT role FROM profiles WHERE id = auth.uid();
-- Should return 'lead'
```

### Issue: Approve button doesn't work
**Fix:** Verify faculty role:
```sql
SELECT role FROM profiles WHERE id = auth.uid();
-- Should return 'faculty' or 'admin'
```

### Issue: Submission fails for custom statement
**Fix:** Ensure statement is approved:
```sql
SELECT status FROM custom_problem_statements WHERE id = 'YOUR_ID';
-- Should be 'approved'
```

---

## 📞 Need Help?

1. Check `CUSTOM_STATEMENTS_GUIDE.md` for detailed documentation
2. Review SQL migration file for schema details
3. Check browser console for errors
4. Verify Supabase logs in dashboard

---

## ✅ Production Ready Checklist

- [ ] Run `SETUP_CUSTOM_STATEMENTS.sql` in production database
- [ ] Test create → approve → submit workflow
- [ ] Verify notifications are sent
- [ ] Check faculty can approve/reject
- [ ] Ensure RLS policies are active
- [ ] Backup database before deployment

---

**Feature Version:** 1.0.0  
**Last Updated:** February 16, 2026  
**Status:** Production Ready ✅
