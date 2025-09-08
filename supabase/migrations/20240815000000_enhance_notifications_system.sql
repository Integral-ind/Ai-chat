-- Enhanced notifications system with all notification types
-- Migration to add new notification types and enhance the system

-- Add new notification types to the enum constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'task_assigned',
  'task_completed', 
  'task_due_soon',
  'task_deadline_reminder',
  'project_invitation',
  'team_invitation',
  'team_member_added',
  'team_member_left', 
  'team_member_removed',
  'team_admin_added',
  'team_admin_removed',
  'team_ownership_transferred',
  'department_member_added',
  'department_member_left',
  'department_admin_changed',
  'project_member_added',
  'project_member_removed',
  'project_ownership_transferred',
  'message_received',
  'chat_mention',
  'call_incoming',
  'call_missed',
  'call_ended',
  'call_answered',
  'call_started',
  'call_declined',
  'system_update',
  'achievement_unlocked',
  'reminder',
  'welcome_notification'
));

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  browser_notifications BOOLEAN DEFAULT TRUE,
  
  -- Task notifications
  task_assigned_email BOOLEAN DEFAULT TRUE,
  task_assigned_push BOOLEAN DEFAULT TRUE,
  task_completed_email BOOLEAN DEFAULT FALSE,
  task_completed_push BOOLEAN DEFAULT TRUE,
  task_due_soon_email BOOLEAN DEFAULT TRUE,
  task_due_soon_push BOOLEAN DEFAULT TRUE,
  task_deadline_reminder_email BOOLEAN DEFAULT TRUE,
  task_deadline_reminder_push BOOLEAN DEFAULT TRUE,
  
  -- Team notifications
  team_member_added_email BOOLEAN DEFAULT TRUE,
  team_member_added_push BOOLEAN DEFAULT TRUE,
  team_member_left_email BOOLEAN DEFAULT TRUE,
  team_member_left_push BOOLEAN DEFAULT TRUE,
  team_admin_added_email BOOLEAN DEFAULT TRUE,
  team_admin_added_push BOOLEAN DEFAULT TRUE,
  team_ownership_transferred_email BOOLEAN DEFAULT TRUE,
  team_ownership_transferred_push BOOLEAN DEFAULT TRUE,
  
  -- Project notifications
  project_member_added_email BOOLEAN DEFAULT TRUE,
  project_member_added_push BOOLEAN DEFAULT TRUE,
  project_ownership_transferred_email BOOLEAN DEFAULT TRUE,
  project_ownership_transferred_push BOOLEAN DEFAULT TRUE,
  
  -- Chat notifications
  message_received_email BOOLEAN DEFAULT FALSE,
  message_received_push BOOLEAN DEFAULT TRUE,
  chat_mention_email BOOLEAN DEFAULT TRUE,
  chat_mention_push BOOLEAN DEFAULT TRUE,
  
  -- Call notifications
  call_incoming_email BOOLEAN DEFAULT FALSE,
  call_incoming_push BOOLEAN DEFAULT TRUE,
  call_missed_email BOOLEAN DEFAULT FALSE,
  call_missed_push BOOLEAN DEFAULT TRUE,
  
  -- System notifications
  system_update_email BOOLEAN DEFAULT TRUE,
  system_update_push BOOLEAN DEFAULT TRUE,
  
  -- Reminder notifications
  reminder_email BOOLEAN DEFAULT TRUE,
  reminder_push BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes on notification preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Enable RLS on notification preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification preferences
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" ON notification_preferences  
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create email notifications queue table for processing
CREATE TABLE IF NOT EXISTS email_notifications_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_name TEXT,
  template_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for email queue
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_notifications_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_for ON email_notifications_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_notifications_queue(user_id);

-- Enable RLS on email queue
ALTER TABLE email_notifications_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for email queue (service role only)
CREATE POLICY "Service role can manage email queue" ON email_notifications_queue
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default preferences for new users
DROP TRIGGER IF EXISTS create_notification_preferences_trigger ON auth.users;
CREATE TRIGGER create_notification_preferences_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Function to update updated_at on preferences
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update updated_at on email queue
CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON email_notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create notifications for team management
CREATE OR REPLACE FUNCTION notify_team_management_changes()
RETURNS TRIGGER AS $$
DECLARE
  team_name_val TEXT;
  actor_name_val TEXT;
  target_user_name_val TEXT;
  notification_type TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- This would be called from your application code
  -- The actual implementation depends on your team management tables
  -- This is a placeholder for the concept
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically create task deadline reminders
CREATE OR REPLACE FUNCTION create_task_deadline_reminders()
RETURNS void AS $$
DECLARE
  task_record RECORD;
  user_prefs RECORD;
BEGIN
  -- Find tasks due in 24 hours that haven't been reminded yet
  FOR task_record IN 
    SELECT t.*, u.id as user_id, u.email
    FROM tasks t
    JOIN auth.users u ON t.assigned_to::UUID = u.id
    WHERE t.due_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
      AND t.status != 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.user_id = u.id 
          AND n.type = 'task_deadline_reminder'
          AND n.metadata->>'task_id' = t.id::TEXT
          AND n.created_at > NOW() - INTERVAL '48 hours'
      )
  LOOP
    -- Check user preferences
    SELECT * INTO user_prefs 
    FROM notification_preferences 
    WHERE user_id = task_record.user_id;
    
    -- Create notification if user wants them
    IF user_prefs IS NULL OR user_prefs.task_deadline_reminder_push THEN
      INSERT INTO notifications (
        user_id, type, title, message, action_url, action_text, metadata
      ) VALUES (
        task_record.user_id,
        'task_deadline_reminder',
        'Task Deadline Reminder',
        format('Reminder: Task "%s" is due soon', task_record.title),
        '/app/tasks',
        'View Task',
        jsonb_build_object(
          'task_id', task_record.id,
          'task_title', task_record.title,
          'due_date', task_record.due_date
        )
      );
    END IF;
    
    -- Queue email if user wants email notifications
    IF user_prefs IS NOT NULL AND user_prefs.task_deadline_reminder_email THEN
      INSERT INTO email_notifications_queue (
        user_id, email_address, subject, body, template_name, template_data
      ) VALUES (
        task_record.user_id,
        task_record.email,
        format('Task Deadline Reminder: %s', task_record.title),
        format('Your task "%s" is due soon. Please check your dashboard for details.', task_record.title),
        'task_deadline_reminder',
        jsonb_build_object(
          'task_title', task_record.title,
          'due_date', task_record.due_date,
          'user_name', task_record.user_id
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get user notification preferences with defaults
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
  prefs notification_preferences;
BEGIN
  SELECT * INTO prefs 
  FROM notification_preferences 
  WHERE user_id = p_user_id;
  
  -- If no preferences found, create default ones
  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO prefs;
  END IF;
  
  RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create additional indexes for better performance with new notification types
CREATE INDEX IF NOT EXISTS idx_notifications_type_user ON notifications(type, user_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin ON notifications USING GIN(metadata);

-- Add some helpful views
CREATE OR REPLACE VIEW notification_stats AS
SELECT 
  user_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count,
  COUNT(*) FILTER (WHERE type LIKE 'task_%') as task_notifications,
  COUNT(*) FILTER (WHERE type LIKE 'team_%') as team_notifications,
  COUNT(*) FILTER (WHERE type LIKE 'call_%') as call_notifications,
  MAX(created_at) as last_notification_at
FROM notifications 
WHERE is_deleted = FALSE
GROUP BY user_id;