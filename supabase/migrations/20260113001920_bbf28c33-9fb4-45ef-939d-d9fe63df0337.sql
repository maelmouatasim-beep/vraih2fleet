-- Add email_notifications preferences column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_notifications JSONB DEFAULT '{
  "subsidy_reminders": true,
  "collaboration_invites": true,
  "project_comments": false,
  "weekly_digest": false
}'::jsonb;

-- Add comment
COMMENT ON COLUMN public.profiles.email_notifications IS 'User preferences for email notifications';