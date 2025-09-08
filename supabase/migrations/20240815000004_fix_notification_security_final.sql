-- Fix notification security issues (Final Corrected Version)
-- This migration addresses security concerns with the notification_stats view

-- Drop the existing view that has security issues
DROP VIEW IF EXISTS notification_stats;

-- Create a secure function instead of a view to get notification statistics
-- This function respects RLS policies and only returns data for the authenticated user
CREATE OR REPLACE FUNCTION get_user_notification_stats(target_user_id UUID DEFAULT NULL)
RETURNS TABLE(
  user_id UUID,
  total_notifications BIGINT,
  unread_count BIGINT,
  task_notifications BIGINT,
  team_notifications BIGINT,
  call_notifications BIGINT,
  last_notification_at TIMESTAMPTZ
) 
AS $$
DECLARE
  query_user_id UUID;
BEGIN
  -- Get the current authenticated user
  query_user_id := auth.uid();
  
  -- If no target_user_id provided, use the authenticated user
  IF target_user_id IS NULL THEN
    target_user_id := query_user_id;
  END IF;
  
  -- Security check: users can only see their own stats unless they're an admin
  -- (You can customize this logic based on your app's requirements)
  IF target_user_id != query_user_id THEN
    -- Optional: Add admin role check here
    -- For now, restrict to own user only
    RAISE EXCEPTION 'Access denied: You can only view your own notification statistics';
  END IF;
  
  -- Return the statistics for the specified user
  RETURN QUERY
  SELECT 
    target_user_id as user_id,
    COUNT(*)::BIGINT as total_notifications,
    COUNT(*) FILTER (WHERE n.is_read = false)::BIGINT as unread_count,
    COUNT(*) FILTER (WHERE n.type LIKE 'task_%')::BIGINT as task_notifications,
    COUNT(*) FILTER (WHERE n.type LIKE 'team_%')::BIGINT as team_notifications,
    COUNT(*) FILTER (WHERE n.type LIKE 'call_%')::BIGINT as call_notifications,
    MAX(n.created_at) as last_notification_at
  FROM notifications n
  WHERE n.user_id = target_user_id
    AND n.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Set the function to use security invoker (caller's permissions)
ALTER FUNCTION get_user_notification_stats(UUID) SECURITY INVOKER;

-- Create a more secure admin-only function for system-wide stats
CREATE OR REPLACE FUNCTION get_system_notification_stats()
RETURNS TABLE(
  total_users_with_notifications BIGINT,
  total_notifications BIGINT,
  total_unread BIGINT,
  notifications_last_24h BIGINT,
  most_active_notification_type TEXT
)
AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Note: You should implement proper role checking here
  -- This is a placeholder - customize based on your app's role system
  -- Example: Check if user has 'admin' role in your user_profiles or roles table
  /*
  SELECT role INTO current_user_role 
  FROM user_profiles 
  WHERE id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  */
  
  -- For now, we'll allow all authenticated users to see system stats
  -- Remove this comment and uncomment the role check above in production
  
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT n.user_id)::BIGINT as total_users_with_notifications,
    COUNT(*)::BIGINT as total_notifications,
    COUNT(*) FILTER (WHERE n.is_read = false)::BIGINT as total_unread,
    COUNT(*) FILTER (WHERE n.created_at >= NOW() - INTERVAL '24 hours')::BIGINT as notifications_last_24h,
    (
      SELECT n2.type 
      FROM notifications n2 
      WHERE n2.is_deleted = FALSE 
        AND n2.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY n2.type 
      ORDER BY COUNT(*) DESC 
      LIMIT 1
    ) as most_active_notification_type
  FROM notifications n
  WHERE n.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Set the function to use security invoker
ALTER FUNCTION get_system_notification_stats() SECURITY INVOKER;

-- Create a secure view that only shows the current user's notification summary
-- This view is safe because it uses auth.uid() to filter results
-- Security is built into the view definition, not through RLS
DROP VIEW IF EXISTS user_notification_summary;
CREATE VIEW user_notification_summary AS
SELECT 
  auth.uid() as user_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count,
  COUNT(*) FILTER (WHERE type LIKE 'task_%') as task_notifications,
  COUNT(*) FILTER (WHERE type LIKE 'team_%') as team_notifications,
  COUNT(*) FILTER (WHERE type LIKE 'call_%') as call_notifications,
  MAX(created_at) as last_notification_at
FROM notifications 
WHERE user_id = auth.uid()
  AND is_deleted = FALSE;

-- Update the existing cleanup function to be more secure
DROP FUNCTION IF EXISTS cleanup_old_notifications();
DROP FUNCTION IF EXISTS cleanup_old_notifications(INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION cleanup_old_notifications(
  hard_delete_days INTEGER DEFAULT 30,
  soft_delete_days INTEGER DEFAULT 90,
  max_notifications_per_user INTEGER DEFAULT 1000
)
RETURNS TABLE(
  hard_deleted_count BIGINT,
  soft_deleted_count BIGINT,
  excess_deleted_count BIGINT
)
AS $$
DECLARE
  hard_deleted BIGINT := 0;
  soft_deleted BIGINT := 0;
  excess_deleted BIGINT := 0;
  current_role TEXT;
BEGIN
  -- Get current role
  SELECT current_user INTO current_role;
  
  -- Only allow service role or postgres role to run cleanup
  IF current_role NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Only service role can perform cleanup operations. Current role: %', current_role;
  END IF;
  
  -- Hard delete notifications that have been soft deleted for specified days
  WITH deleted_rows AS (
    DELETE FROM notifications 
    WHERE is_deleted = TRUE 
      AND updated_at < NOW() - (hard_delete_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO hard_deleted FROM deleted_rows;
  
  -- Soft delete read notifications older than specified days
  WITH updated_rows AS (
    UPDATE notifications 
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE is_read = TRUE 
      AND is_deleted = FALSE 
      AND created_at < NOW() - (soft_delete_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO soft_deleted FROM updated_rows;
  
  -- Keep only the latest N notifications per user
  WITH excess_notifications AS (
    SELECT id
    FROM (
      SELECT id, 
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM notifications 
      WHERE is_deleted = FALSE
    ) ranked
    WHERE rn > max_notifications_per_user
  ),
  deleted_excess AS (
    UPDATE notifications 
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE id IN (SELECT id FROM excess_notifications)
    RETURNING id
  )
  SELECT COUNT(*) INTO excess_deleted FROM deleted_excess;
  
  RETURN QUERY SELECT hard_deleted, soft_deleted, excess_deleted;
END;
$$ LANGUAGE plpgsql;

-- Set cleanup function to use security invoker
ALTER FUNCTION cleanup_old_notifications(INTEGER, INTEGER, INTEGER) SECURITY INVOKER;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION get_user_notification_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_notification_stats() TO authenticated;
GRANT SELECT ON user_notification_summary TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications(INTEGER, INTEGER, INTEGER) TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION get_user_notification_stats(UUID) IS 
'Securely retrieves notification statistics for a user. Uses SECURITY INVOKER to respect RLS policies and user permissions.';

COMMENT ON FUNCTION get_system_notification_stats() IS 
'Provides system-wide notification statistics. Should include admin role checking in production.';

COMMENT ON VIEW user_notification_summary IS 
'Secure view showing notification summary for the current authenticated user only. Security is enforced through auth.uid() filtering in the view definition.';

COMMENT ON FUNCTION cleanup_old_notifications(INTEGER, INTEGER, INTEGER) IS
'Cleans up old notifications. Restricted to service role only for security.';

-- Verify the functions and view were created successfully
DO $$
BEGIN
    -- Test that the functions exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_notification_stats') THEN
        RAISE EXCEPTION 'Function get_user_notification_stats was not created successfully';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_system_notification_stats') THEN
        RAISE EXCEPTION 'Function get_system_notification_stats was not created successfully';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_notifications') THEN
        RAISE EXCEPTION 'Function cleanup_old_notifications was not created successfully';
    END IF;
    
    -- Test that the view exists
    IF NOT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'user_notification_summary') THEN
        RAISE EXCEPTION 'View user_notification_summary was not created successfully';
    END IF;
    
    RAISE NOTICE 'All notification security components created successfully!';
END;
$$;

-- Example usage queries (as comments for documentation)
/*
-- Get current user's notification stats
SELECT * FROM get_user_notification_stats();

-- Get current user's notification stats for specific user (will fail if not own user)
SELECT * FROM get_user_notification_stats('specific-user-id');

-- Get system-wide stats (consider adding admin role check in production)
SELECT * FROM get_system_notification_stats();

-- Get current user's summary via secure view
SELECT * FROM user_notification_summary;

-- Run cleanup (service role only)
SELECT * FROM cleanup_old_notifications();

-- Run cleanup with custom parameters (service role only)
SELECT * FROM cleanup_old_notifications(60, 120, 500);
*/