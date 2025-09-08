-- Notification triggers and functions for automated notification generation
-- This migration creates database functions and triggers to automatically generate notifications

-- Helper function to get user profile information
CREATE OR REPLACE FUNCTION get_user_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_name TEXT;
BEGIN
  SELECT COALESCE(full_name, email) INTO user_name
  FROM user_profiles 
  WHERE id = user_id;
  
  RETURN COALESCE(user_name, 'Unknown User');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create task assignment notifications
CREATE OR REPLACE FUNCTION create_task_assignment_notification()
RETURNS TRIGGER AS $$
DECLARE
  assigner_name TEXT;
  task_title TEXT;
BEGIN
  -- Only create notification if task is assigned to someone other than the assigner
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != COALESCE(NEW.assigner_id, NEW.user_id) THEN
    assigner_name := get_user_name(COALESCE(NEW.assigner_id, NEW.user_id));
    task_title := NEW.title;
    
    INSERT INTO notifications (
      user_id, type, title, message, action_url, action_text, metadata
    ) VALUES (
      NEW.assigned_to,
      'task_assigned',
      'New Task Assigned',
      format('%s assigned you the task "%s"', assigner_name, task_title),
      '/app/tasks',
      'View Task',
      jsonb_build_object(
        'task_id', NEW.id,
        'task_title', task_title,
        'assigner_name', assigner_name,
        'due_date', NEW.due_date
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create task completion notifications
CREATE OR REPLACE FUNCTION create_task_completion_notification()
RETURNS TRIGGER AS $$
DECLARE
  assigner_name TEXT;
  task_title TEXT;
BEGIN
  -- Only create notification if task status changed to completed and there's an assigner
  IF OLD.status != 'completed' AND NEW.status = 'completed' AND NEW.assigner_id IS NOT NULL AND NEW.assigner_id != NEW.assigned_to THEN
    assigner_name := get_user_name(NEW.assigned_to);
    task_title := NEW.title;
    
    INSERT INTO notifications (
      user_id, type, title, message, action_url, action_text, metadata
    ) VALUES (
      NEW.assigner_id,
      'task_completed',
      'Task Completed',
      format('%s completed the task "%s"', assigner_name, task_title),
      '/app/tasks',
      'View Task',
      jsonb_build_object(
        'task_id', NEW.id,
        'task_title', task_title,
        'completer_name', assigner_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create team member notifications
CREATE OR REPLACE FUNCTION create_team_member_notification()
RETURNS TRIGGER AS $$
DECLARE
  team_name TEXT;
  actor_name TEXT;
  notification_type TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get team name
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  
  IF TG_OP = 'INSERT' THEN
    -- Get the current user who added the member (this would need to be passed in via application)
    -- For now, we'll use a simplified approach
    actor_name := 'Someone';
    
    IF NEW.role = 'admin' THEN
      notification_type := 'team_admin_added';
      notification_title := 'Promoted to Team Admin';
      notification_message := format('%s made you an admin of team "%s"', actor_name, team_name);
    ELSE
      notification_type := 'team_member_added';
      notification_title := 'Added to Team';
      notification_message := format('%s added you to the team "%s"', actor_name, team_name);
    END IF;
    
    INSERT INTO notifications (
      user_id, type, title, message, action_url, action_text, metadata
    ) VALUES (
      NEW.user_id,
      notification_type,
      notification_title,
      notification_message,
      format('/app/collaboration/teams/%s', NEW.team_id),
      'View Team',
      jsonb_build_object(
        'team_id', NEW.team_id,
        'team_name', team_name,
        'actor_name', actor_name
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create project member notifications
CREATE OR REPLACE FUNCTION create_project_member_notification()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
  actor_name TEXT;
  notification_type TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get project name
  SELECT name INTO project_name FROM projects WHERE id = NEW.project_id;
  
  IF TG_OP = 'INSERT' THEN
    actor_name := 'Someone';
    notification_type := 'project_member_added';
    notification_title := 'Added to Project';
    notification_message := format('%s added you to the project "%s"', actor_name, project_name);
    
    INSERT INTO notifications (
      user_id, type, title, message, action_url, action_text, metadata
    ) VALUES (
      NEW.user_id,
      notification_type,
      notification_title,
      notification_message,
      format('/app/collaboration/projects/%s', NEW.project_id),
      'View Project',
      jsonb_build_object(
        'project_id', NEW.project_id,
        'project_name', project_name,
        'actor_name', actor_name
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  -- Hard delete notifications that have been soft deleted for more than 30 days
  DELETE FROM notifications 
  WHERE is_deleted = TRUE 
    AND updated_at < NOW() - INTERVAL '30 days';
    
  -- Soft delete read notifications older than 90 days
  UPDATE notifications 
  SET is_deleted = TRUE, updated_at = NOW()
  WHERE is_read = TRUE 
    AND is_deleted = FALSE 
    AND created_at < NOW() - INTERVAL '90 days';
    
  -- Keep only the latest 1000 notifications per user
  WITH ranked_notifications AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM notifications 
    WHERE is_deleted = FALSE
  )
  UPDATE notifications 
  SET is_deleted = TRUE, updated_at = NOW()
  WHERE id IN (
    SELECT id FROM ranked_notifications WHERE rn > 1000
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send welcome notification to new users
CREATE OR REPLACE FUNCTION create_welcome_notification_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create welcome notification
  INSERT INTO notifications (
    user_id, type, title, message, action_url, action_text, metadata
  ) VALUES (
    NEW.id,
    'welcome_notification',
    'Welcome to the Platform!',
    'Get started by exploring your dashboard and connecting with your team',
    '/app/dashboard',
    'Explore Dashboard',
    jsonb_build_object('welcome_type', 'new_user')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to batch create notifications
CREATE OR REPLACE FUNCTION create_bulk_notifications(
  notification_data jsonb[]
) RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
  notification jsonb;
BEGIN
  FOREACH notification IN ARRAY notification_data
  LOOP
    INSERT INTO notifications (
      user_id, type, title, message, action_url, action_text, metadata
    ) VALUES (
      (notification->>'user_id')::UUID,
      notification->>'type',
      notification->>'title',
      notification->>'message',
      notification->>'action_url',
      notification->>'action_text',
      COALESCE(notification->'metadata', '{}'::jsonb)
    );
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic notification generation
DROP TRIGGER IF EXISTS task_assignment_notification_trigger ON tasks;
CREATE TRIGGER task_assignment_notification_trigger
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION create_task_assignment_notification();

DROP TRIGGER IF EXISTS task_completion_notification_trigger ON tasks;
CREATE TRIGGER task_completion_notification_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION create_task_completion_notification();

-- Note: Team and project member triggers are commented out because they would need
-- additional context about who is performing the action, which is better handled 
-- at the application level. Uncomment if you want basic automated notifications:

-- DROP TRIGGER IF EXISTS team_member_notification_trigger ON team_members;
-- CREATE TRIGGER team_member_notification_trigger
--   AFTER INSERT ON team_members
--   FOR EACH ROW
--   EXECUTE FUNCTION create_team_member_notification();

-- DROP TRIGGER IF EXISTS project_member_notification_trigger ON project_members;
-- CREATE TRIGGER project_member_notification_trigger
--   AFTER INSERT ON project_members
--   FOR EACH ROW
--   EXECUTE FUNCTION create_project_member_notification();

-- Trigger for welcome notifications on new user registration
DROP TRIGGER IF EXISTS welcome_notification_trigger ON auth.users;
CREATE TRIGGER welcome_notification_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_welcome_notification_for_new_user();

-- Create a scheduled function to run notification cleanup daily
-- Note: This requires pg_cron extension or can be run manually/via cron job
-- SELECT cron.schedule('cleanup-old-notifications', '0 2 * * *', 'SELECT cleanup_old_notifications();');

-- Function to get notification statistics for monitoring
CREATE OR REPLACE FUNCTION get_notification_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
  date_created DATE,
  notification_type TEXT,
  total_count BIGINT,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(n.created_at) as date_created,
    n.type as notification_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE n.is_read = false) as unread_count
  FROM notifications n
  WHERE n.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND n.is_deleted = false
  GROUP BY DATE(n.created_at), n.type
  ORDER BY date_created DESC, notification_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read in bulk
CREATE OR REPLACE FUNCTION mark_notifications_read_bulk(
  notification_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications 
  SET is_read = true, updated_at = NOW()
  WHERE id = ANY(notification_ids)
    AND is_read = false;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user notification preferences with defaults
CREATE OR REPLACE FUNCTION get_user_notification_preferences_with_defaults(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
  prefs notification_preferences;
BEGIN
  SELECT * INTO prefs 
  FROM notification_preferences 
  WHERE user_id = p_user_id;
  
  -- If no preferences found, create and return defaults
  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO prefs;
  END IF;
  
  RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_name(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_bulk_notifications(jsonb[]) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION get_notification_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_read_bulk(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notification_preferences_with_defaults(UUID) TO authenticated;