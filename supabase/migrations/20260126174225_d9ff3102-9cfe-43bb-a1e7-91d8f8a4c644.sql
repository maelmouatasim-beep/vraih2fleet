-- =============================================
-- Security Fix: Protect sensitive profile data
-- =============================================

-- The current profiles RLS policy allows users to see only their own profile
-- which is correct. However, for collaboration features (showing names in comments),
-- we need a secure way for users to see limited info about collaborators.
-- 
-- Solution: Create a public view that shows only non-sensitive profile fields
-- and can be used for displaying collaborator names/avatars.

-- Create a public-safe view for profile display (excludes email and sensitive fields)
CREATE OR REPLACE VIEW public.profiles_display
WITH (security_invoker = on) AS
SELECT 
    id,
    full_name,
    avatar_url,
    company,
    function_title,
    created_at
FROM public.profiles;

-- Note: The base profiles table already has correct RLS: auth.uid() = id
-- Users can only read/write their own profile directly.
-- The profiles_display view inherits RLS from the base table.

-- =============================================
-- Security Fix: Protect telematics credentials
-- =============================================

-- The telematics_connections table stores encrypted credentials.
-- While the RLS policy restricts access to owner only, we should
-- create a view that excludes the encrypted_credentials column
-- for most read operations in the application.

-- Create a safe view for telematics connections display
CREATE OR REPLACE VIEW public.telematics_connections_safe
WITH (security_invoker = on) AS
SELECT 
    id,
    user_id,
    provider,
    database,
    username,
    status,
    last_sync_at,
    created_at,
    updated_at
    -- encrypted_credentials is intentionally excluded
FROM public.telematics_connections;

-- Note: The base table keeps RLS: auth.uid() = user_id
-- Only the owner can access their own connections.
-- For operations needing credentials (sync, reauth), use the base table via edge functions.