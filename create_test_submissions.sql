-- CREATE TEST SUBMISSION DATA
-- Run this in your Supabase SQL Editor to add sample submission data

-- Insert test submissions for each team to verify the system works
INSERT INTO submissions (team_id, title, description, tech_stack, solution_link, status)
SELECT 
    t.id as team_id,
    'AI-Powered Learning Assistant for ' || t.name as title,
    'Our team has developed an innovative AI-powered learning assistant that personalizes education experiences. The solution uses machine learning to adapt to individual learning styles and provides real-time feedback to students. Key features include: automated content generation, progress tracking, intelligent tutoring system, and collaborative learning tools.' as description,
    'React.js, Node.js, Express, PostgreSQL, OpenAI API, TensorFlow, Docker, AWS' as tech_stack,
    'https://github.com/' || lower(replace(t.name, ' ', '-')) || '/ai-learning-assistant' as solution_link,
    'submitted' as status
FROM teams t
WHERE t.id IN (
    SELECT id FROM teams LIMIT 3  -- Add submissions for first 3 teams
);

-- Verify the submissions were created
SELECT 
    s.title,
    t.name as team_name,
    s.status,
    s.created_at
FROM submissions s
JOIN teams t ON s.team_id = t.id
ORDER BY s.created_at DESC;