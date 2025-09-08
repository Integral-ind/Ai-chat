-- Create push subscriptions table for web push notifications
-- This migration creates the necessary tables and functions for push notification management

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  device_name TEXT,
  browser_name TEXT,
  os_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique subscription per user per endpoint
  UNIQUE(user_id, endpoint)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_used ON push_subscriptions(last_used_at DESC);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (for cleanup and admin tasks)
CREATE POLICY "Service role can manage all push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to upsert push subscriptions (used by pushSubscriptionService)
CREATE OR REPLACE FUNCTION upsert_push_subscription(
  p_user_id UUID,
  p_endpoint TEXT,
  p_p256dh_key TEXT,
  p_auth_key TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_browser_name TEXT DEFAULT NULL,
  p_os_name TEXT DEFAULT NULL
) RETURNS push_subscriptions AS $$
DECLARE
  result_subscription push_subscriptions;
BEGIN
  -- Insert or update the push subscription
  INSERT INTO push_subscriptions (
    user_id, endpoint, p256dh_key, auth_key, 
    user_agent, device_name, browser_name, os_name,
    is_active, last_used_at, created_at, updated_at
  ) VALUES (
    p_user_id, p_endpoint, p_p256dh_key, p_auth_key,
    p_user_agent, p_device_name, p_browser_name, p_os_name,
    TRUE, NOW(), NOW(), NOW()
  )
  ON CONFLICT (user_id, endpoint) 
  DO UPDATE SET
    p256dh_key = EXCLUDED.p256dh_key,
    auth_key = EXCLUDED.auth_key,
    user_agent = EXCLUDED.user_agent,
    device_name = EXCLUDED.device_name,
    browser_name = EXCLUDED.browser_name,
    os_name = EXCLUDED.os_name,
    is_active = TRUE,
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO result_subscription;
  
  RETURN result_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark a push subscription as used (for analytics)
CREATE OR REPLACE FUNCTION mark_push_subscription_used(
  p_endpoint TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE push_subscriptions 
  SET last_used_at = NOW(), updated_at = NOW()
  WHERE endpoint = p_endpoint AND is_active = TRUE;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup inactive push subscriptions
CREATE OR REPLACE FUNCTION cleanup_inactive_push_subscriptions(
  inactive_days INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete subscriptions that haven't been used in X days
  WITH deleted AS (
    DELETE FROM push_subscriptions 
    WHERE last_used_at < NOW() - (inactive_days || ' days')::INTERVAL
      OR (is_active = FALSE AND updated_at < NOW() - INTERVAL '7 days')
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create push_subscription_stats view for analytics
CREATE OR REPLACE VIEW push_subscription_stats AS
SELECT 
  user_id,
  COUNT(*) as total_subscriptions,
  COUNT(*) FILTER (WHERE is_active = true) as active_subscriptions,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as recent_subscriptions,
  MAX(last_used_at) as last_activity,
  STRING_AGG(DISTINCT browser_name, ', ') as browsers_used,
  STRING_AGG(DISTINCT os_name, ', ') as operating_systems
FROM push_subscriptions 
GROUP BY user_id;

-- Grant necessary permissions
GRANT SELECT ON push_subscription_stats TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_push_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_push_subscription_used(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_inactive_push_subscriptions(INTEGER) TO service_role;

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE push_subscriptions IS 'Stores web push notification subscriptions for users';
COMMENT ON FUNCTION upsert_push_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Creates or updates a push subscription for a user';
COMMENT ON FUNCTION mark_push_subscription_used(TEXT) IS 'Updates the last_used_at timestamp for a subscription';
COMMENT ON FUNCTION cleanup_inactive_push_subscriptions(INTEGER) IS 'Removes push subscriptions that have been inactive for specified days';
COMMENT ON VIEW push_subscription_stats IS 'Provides statistics about push subscriptions per user';

-- Insert a welcome push notification function (optional)
CREATE OR REPLACE FUNCTION send_welcome_push_notification(
  p_user_id UUID
) RETURNS VOID AS $$
BEGIN
  -- This function can be called after user registration to send a welcome push notification
  -- The actual implementation would be handled by your Edge Functions
  INSERT INTO notifications (
    user_id, type, title, message, action_url, action_text, metadata
  ) VALUES (
    p_user_id,
    'welcome_notification',
    'Welcome to Integral!',
    'Thanks for joining! Enable push notifications to stay updated.',
    '/app/settings',
    'Enable Notifications',
    jsonb_build_object('welcome_type', 'push_setup')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_welcome_push_notification(UUID) TO authenticated;