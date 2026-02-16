-- Migration: Remove duplicate problem statements and add unique constraint
-- Date: 2026-02-16
-- Description: Removes duplicate problem statements based on title and adds unique constraint

-- Remove duplicate problem statements, keeping only the first occurrence
DELETE FROM problem_statements a USING problem_statements b
WHERE a.id > b.id 
AND a.title = b.title;

-- Add unique constraint on title to prevent future duplicates
ALTER TABLE problem_statements 
ADD CONSTRAINT problem_statements_title_unique UNIQUE (title);
