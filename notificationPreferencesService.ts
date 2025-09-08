import { supabase } from './supabaseClient';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  browser_notifications: boolean;
  
  // Task notifications
  task_assigned_email: boolean;
  task_assigned_push: boolean;
  task_completed_email: boolean;
  task_completed_push: boolean;
  task_due_soon_email: boolean;
  task_due_soon_push: boolean;
  task_deadline_reminder_email: boolean;
  task_deadline_reminder_push: boolean;
  
  // Team notifications
  team_member_added_email: boolean;
  team_member_added_push: boolean;
  team_member_left_email: boolean;
  team_member_left_push: boolean;
  team_admin_added_email: boolean;
  team_admin_added_push: boolean;
  team_ownership_transferred_email: boolean;
  team_ownership_transferred_push: boolean;
  
  // Project notifications
  project_member_added_email: boolean;
  project_member_added_push: boolean;
  project_ownership_transferred_email: boolean;
  project_ownership_transferred_push: boolean;
  
  // Chat notifications
  message_received_email: boolean;
  message_received_push: boolean;
  chat_mention_email: boolean;
  chat_mention_push: boolean;
  
  // Call notifications
  call_incoming_email: boolean;
  call_incoming_push: boolean;
  call_missed_email: boolean;
  call_missed_push: boolean;
  
  // System notifications
  system_update_email: boolean;
  system_update_push: boolean;
  
  // Reminder notifications
  reminder_email: boolean;
  reminder_push: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPreferencesData {
  email_notifications?: boolean;
  push_notifications?: boolean;
  browser_notifications?: boolean;
  
  // Task notifications
  task_assigned_email?: boolean;
  task_assigned_push?: boolean;
  task_completed_email?: boolean;
  task_completed_push?: boolean;
  task_due_soon_email?: boolean;
  task_due_soon_push?: boolean;
  task_deadline_reminder_email?: boolean;
  task_deadline_reminder_push?: boolean;
  
  // Team notifications
  team_member_added_email?: boolean;
  team_member_added_push?: boolean;
  team_member_left_email?: boolean;
  team_member_left_push?: boolean;
  team_admin_added_email?: boolean;
  team_admin_added_push?: boolean;
  team_ownership_transferred_email?: boolean;
  team_ownership_transferred_push?: boolean;
  
  // Project notifications
  project_member_added_email?: boolean;
  project_member_added_push?: boolean;
  project_ownership_transferred_email?: boolean;
  project_ownership_transferred_push?: boolean;
  
  // Chat notifications
  message_received_email?: boolean;
  message_received_push?: boolean;
  chat_mention_email?: boolean;
  chat_mention_push?: boolean;
  
  // Call notifications
  call_incoming_email?: boolean;
  call_incoming_push?: boolean;
  call_missed_email?: boolean;
  call_missed_push?: boolean;
  
  // System notifications
  system_update_email?: boolean;
  system_update_push?: boolean;
  
  // Reminder notifications
  reminder_email?: boolean;
  reminder_push?: boolean;
}

export type NotificationChannel = 'email' | 'push' | 'browser';
export type NotificationType = keyof Pick<NotificationPreferences, 
  'task_assigned_email' | 'task_completed_email' | 'task_due_soon_email' | 'task_deadline_reminder_email' |
  'team_member_added_email' | 'team_member_left_email' | 'team_admin_added_email' | 'team_ownership_transferred_email' |
  'project_member_added_email' | 'project_ownership_transferred_email' |
  'message_received_email' | 'chat_mention_email' |
  'call_incoming_email' | 'call_missed_email' |
  'system_update_email' | 'reminder_email'
>;

class NotificationPreferencesService {
  // Get user notification preferences
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found, create default ones
          return this.createDefaultPreferences(userId);
        }
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      return null;
    }
  }

  // Create default notification preferences for a user
  async createDefaultPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .insert([{ user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating default notification preferences:', error);
      return null;
    }
  }

  // Update notification preferences
  async updatePreferences(
    userId: string, 
    updates: UpdateNotificationPreferencesData
  ): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return null;
    }
  }

  // Check if user should receive a notification via specific channel
  async shouldNotify(
    userId: string, 
    notificationType: string,
    channel: NotificationChannel
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      if (!preferences) return true; // Default to notify if no preferences

      // Check global channel preference first
      if (channel === 'email' && !preferences.email_notifications) return false;
      if (channel === 'push' && !preferences.push_notifications) return false;
      if (channel === 'browser' && !preferences.browser_notifications) return false;

      // Check specific notification type preference
      const preferenceKey = `${notificationType}_${channel}` as keyof NotificationPreferences;
      if (preferenceKey in preferences) {
        return Boolean(preferences[preferenceKey]);
      }

      // Default to true if preference doesn't exist
      return true;
    } catch (error) {
      console.error('Error checking notification preference:', error);
      return true; // Default to notify on error
    }
  }

  // Bulk update preferences by category
  async updatePreferencesCategory(
    userId: string,
    category: 'tasks' | 'teams' | 'projects' | 'chat' | 'calls' | 'system',
    enabled: boolean,
    channels: NotificationChannel[] = ['email', 'push']
  ): Promise<NotificationPreferences | null> {
    const updates: UpdateNotificationPreferencesData = {};

    // Map categories to their notification types
    const categoryMap = {
      tasks: [
        'task_assigned', 'task_completed', 'task_due_soon', 'task_deadline_reminder'
      ],
      teams: [
        'team_member_added', 'team_member_left', 'team_admin_added', 'team_ownership_transferred'
      ],
      projects: [
        'project_member_added', 'project_ownership_transferred'
      ],
      chat: [
        'message_received', 'chat_mention'
      ],
      calls: [
        'call_incoming', 'call_missed'
      ],
      system: [
        'system_update', 'reminder'
      ]
    };

    const notificationTypes = categoryMap[category] || [];
    
    notificationTypes.forEach(type => {
      channels.forEach(channel => {
        const key = `${type}_${channel}` as keyof UpdateNotificationPreferencesData;
        updates[key] = enabled;
      });
    });

    return this.updatePreferences(userId, updates);
  }

  // Get preferences summary for UI display
  async getPreferencesSummary(userId: string): Promise<{
    email_enabled: boolean;
    push_enabled: boolean;
    browser_enabled: boolean;
    categories: {
      tasks: { email: boolean; push: boolean };
      teams: { email: boolean; push: boolean };
      projects: { email: boolean; push: boolean };
      chat: { email: boolean; push: boolean };
      calls: { email: boolean; push: boolean };
      system: { email: boolean; push: boolean };
    };
  } | null> {
    try {
      const preferences = await this.getUserPreferences(userId);
      if (!preferences) return null;

      return {
        email_enabled: preferences.email_notifications,
        push_enabled: preferences.push_notifications,
        browser_enabled: preferences.browser_notifications,
        categories: {
          tasks: {
            email: preferences.task_assigned_email && preferences.task_completed_email,
            push: preferences.task_assigned_push && preferences.task_completed_push
          },
          teams: {
            email: preferences.team_member_added_email && preferences.team_admin_added_email,
            push: preferences.team_member_added_push && preferences.team_admin_added_push
          },
          projects: {
            email: preferences.project_member_added_email,
            push: preferences.project_member_added_push
          },
          chat: {
            email: preferences.message_received_email && preferences.chat_mention_email,
            push: preferences.message_received_push && preferences.chat_mention_push
          },
          calls: {
            email: preferences.call_incoming_email,
            push: preferences.call_incoming_push
          },
          system: {
            email: preferences.system_update_email && preferences.reminder_email,
            push: preferences.system_update_push && preferences.reminder_push
          }
        }
      };
    } catch (error) {
      console.error('Error getting preferences summary:', error);
      return null;
    }
  }

  // Enable/disable all notifications for a user
  async setAllNotifications(
    userId: string, 
    enabled: boolean,
    channels: NotificationChannel[] = ['email', 'push', 'browser']
  ): Promise<NotificationPreferences | null> {
    const updates: UpdateNotificationPreferencesData = {};

    // Define all notification type keys
    const allNotificationKeys = [
      'task_assigned', 'task_completed', 'task_due_soon', 'task_deadline_reminder',
      'team_member_added', 'team_member_left', 'team_admin_added', 'team_ownership_transferred',
      'project_member_added', 'project_ownership_transferred',
      'message_received', 'chat_mention',
      'call_incoming', 'call_missed',
      'system_update', 'reminder'
    ];

    if (channels.includes('email')) {
      updates.email_notifications = enabled;
      // Set all email preferences
      allNotificationKeys.forEach(key => {
        const emailKey = `${key}_email` as keyof UpdateNotificationPreferencesData;
        updates[emailKey] = enabled;
      });
    }

    if (channels.includes('push')) {
      updates.push_notifications = enabled;
      // Set all push preferences
      allNotificationKeys.forEach(key => {
        const pushKey = `${key}_push` as keyof UpdateNotificationPreferencesData;
        updates[pushKey] = enabled;
      });
    }

    if (channels.includes('browser')) {
      updates.browser_notifications = enabled;
    }

    return this.updatePreferences(userId, updates);
  }

  // Delete user preferences (e.g., when user account is deleted)
  async deleteUserPreferences(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting notification preferences:', error);
      return false;
    }
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();