import { supabase } from './supabaseClient';
import { pushNotificationService } from './pushNotificationService';

export type NotificationType = 
  | 'task_assigned'
  | 'task_completed'
  | 'task_due_soon'
  | 'task_deadline_reminder'
  | 'project_invitation'
  | 'team_invitation'
  | 'team_member_added'
  | 'team_member_left'
  | 'team_member_removed'
  | 'team_admin_added'
  | 'team_admin_removed'
  | 'team_ownership_transferred'
  | 'department_member_added'
  | 'department_member_left'
  | 'department_admin_changed'
  | 'project_member_added'
  | 'project_member_removed'
  | 'project_ownership_transferred'
  | 'message_received'
  | 'chat_mention'
  | 'call_incoming'
  | 'call_missed'
  | 'call_ended'
  | 'call_answered'
  | 'call_started'
  | 'call_declined'
  | 'system_update'
  | 'achievement_unlocked'
  | 'reminder'
  | 'welcome_notification';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  is_deleted: boolean;
  action_url?: string;
  action_text?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationData {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string;
  action_text?: string;
  metadata?: Record<string, any>;
}

class NotificationService {
  // Get all notifications for a user
  async getUserNotifications(userId: string, limit = 20): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // Get unread notifications count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_deleted', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  // Create a new notification
  async createNotification(data: CreateNotificationData): Promise<Notification | null> {
    try {
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert([{
          ...data,
          is_read: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // Delete a notification (soft delete)
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  // Clear all notifications for a user (soft delete)
  async clearAllNotifications(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_deleted', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      return false;
    }
  }

  // Subscribe to real-time notifications for a user
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const notification = payload.new as Notification;
          callback(notification);
        }
      )
      .subscribe();

    return subscription;
  }

  // Unsubscribe from real-time notifications
  unsubscribeFromNotifications(subscription: any) {
    supabase.removeChannel(subscription);
  }

  // Helper method to create task-related notifications
  async createTaskNotification(
    userId: string,
    type: 'task_assigned' | 'task_completed' | 'task_due_soon',
    taskTitle: string,
    taskId: string,
    assignerName?: string
  ): Promise<Notification | null> {
    let title = '';
    let message = '';
    let actionUrl = `/app/tasks`;

    switch (type) {
      case 'task_assigned':
        title = 'New Task Assigned';
        message = `${assignerName || 'Someone'} assigned you the task "${taskTitle}"`;
        break;
      case 'task_completed':
        title = 'Task Completed';
        message = `Task "${taskTitle}" has been completed`;
        break;
      case 'task_due_soon':
        title = 'Task Due Soon';
        message = `Task "${taskTitle}" is due soon`;
        break;
    }

    return this.createNotification({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl,
      action_text: 'View Task',
      metadata: { task_id: taskId, task_title: taskTitle }
    });
  }

  // Helper method to create team/project notifications
  async createTeamNotification(
    userId: string,
    type: 'team_invitation' | 'project_invitation',
    teamOrProjectName: string,
    inviterName: string,
    inviteId?: string
  ): Promise<Notification | null> {
    const isTeam = type === 'team_invitation';
    const title = isTeam ? 'Team Invitation' : 'Project Invitation';
    const message = `${inviterName} invited you to join ${isTeam ? 'team' : 'project'} "${teamOrProjectName}"`;
    const actionUrl = isTeam ? `/app/collaboration/teams` : `/app/collaboration/projects`;

    return this.createNotification({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl,
      action_text: 'View Invitation',
      metadata: { 
        name: teamOrProjectName, 
        inviter: inviterName,
        invite_id: inviteId
      }
    });
  }

  // Helper method to create system notifications
  async createSystemNotification(
    userId: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<Notification | null> {
    return this.createNotification({
      user_id: userId,
      type: 'system_update',
      title,
      message,
      action_url: actionUrl,
      action_text: actionText
    });
  }

  // Helper method to create call notifications
  async createCallNotification(
    userId: string,
    type: 'call_incoming' | 'call_missed' | 'call_ended' | 'call_answered' | 'call_started' | 'call_declined',
    callerName: string,
    callId: string,
    callType: 'voice' | 'video' = 'voice'
  ): Promise<Notification | null> {
    let title = '';
    let message = '';
    let actionUrl = '';
    let actionText = '';

    switch (type) {
      case 'call_incoming':
        title = `Incoming ${callType} call`;
        message = `${callerName} is calling you`;
        actionUrl = callType === 'video' ? `/app/call/${callId}` : `/app/voice/${callId}`;
        actionText = 'Answer';
        break;
      case 'call_missed':
        title = 'Missed call';
        message = `You missed a ${callType} call from ${callerName}`;
        actionUrl = '/app/connect';
        actionText = 'Call back';
        break;
      case 'call_ended':
        title = 'Call ended';
        message = `${callType === 'video' ? 'Video' : 'Voice'} call with ${callerName} has ended`;
        break;
      case 'call_answered':
        title = 'Call answered';
        message = `${callerName} answered your call`;
        break;
      case 'call_started':
        title = 'Call started';
        message = `${callType === 'video' ? 'Video' : 'Voice'} call with ${callerName} has started`;
        break;
      case 'call_declined':
        title = 'Call declined';
        message = `${callerName} declined your ${callType} call`;
        actionUrl = '/app/connect';
        actionText = 'Try again';
        break;
    }

    return this.createNotification({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl,
      action_text: actionText,
      metadata: { 
        call_id: callId, 
        caller_name: callerName,
        call_type: callType
      }
    });
  }

  // Helper method to create team management notifications
  async createTeamManagementNotification(
    userId: string,
    type: 'team_member_added' | 'team_member_left' | 'team_member_removed' | 'team_admin_added' | 'team_admin_removed' | 'team_ownership_transferred',
    teamName: string,
    teamId: string,
    actorName: string,
    targetUserName?: string
  ): Promise<Notification | null> {
    let title = '';
    let message = '';
    const actionUrl = `/app/collaboration/teams/${teamId}`;
    let actionText = 'View Team';

    switch (type) {
      case 'team_member_added':
        title = 'Added to Team';
        message = `${actorName} added you to the team "${teamName}"`;
        break;
      case 'team_member_left':
        title = 'Member Left Team';
        message = `${targetUserName || actorName} left the team "${teamName}"`;
        break;
      case 'team_member_removed':
        title = 'Member Removed from Team';
        message = `${actorName} removed ${targetUserName} from team "${teamName}"`;
        break;
      case 'team_admin_added':
        title = 'Promoted to Team Admin';
        message = `${actorName} made you an admin of team "${teamName}"`;
        break;
      case 'team_admin_removed':
        title = 'Admin Role Removed';
        message = `${actorName} removed your admin role from team "${teamName}"`;
        break;
      case 'team_ownership_transferred':
        title = 'Team Ownership Transferred';
        message = `${actorName} transferred ownership of team "${teamName}" to you`;
        actionText = 'Manage Team';
        break;
    }

    return this.createNotification({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl,
      action_text: actionText,
      metadata: { 
        team_id: teamId, 
        team_name: teamName,
        actor_name: actorName,
        target_user_name: targetUserName
      }
    });
  }

  // Helper method to create department management notifications
  async createDepartmentManagementNotification(
    userId: string,
    type: 'department_member_added' | 'department_member_left' | 'department_admin_changed',
    departmentName: string,
    departmentId: string,
    teamName: string,
    teamId: string,
    actorName: string,
    targetUserName?: string
  ): Promise<Notification | null> {
    let title = '';
    let message = '';
    const actionUrl = `/app/collaboration/teams/${teamId}/department/${departmentId}`;
    const actionText = 'View Department';

    switch (type) {
      case 'department_member_added':
        title = 'Added to Department';
        message = `${actorName} added you to the "${departmentName}" department in team "${teamName}"`;
        break;
      case 'department_member_left':
        title = 'Member Left Department';
        message = `${targetUserName || actorName} left the "${departmentName}" department`;
        break;
      case 'department_admin_changed':
        title = 'Department Admin Role Changed';
        message = `${actorName} changed your admin role in the "${departmentName}" department`;
        break;
    }

    return this.createNotification({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl,
      action_text: actionText,
      metadata: { 
        department_id: departmentId, 
        department_name: departmentName,
        team_id: teamId,
        team_name: teamName,
        actor_name: actorName,
        target_user_name: targetUserName
      }
    });
  }

  // Helper method to create project management notifications
  async createProjectManagementNotification(
    userId: string,
    type: 'project_member_added' | 'project_member_removed' | 'project_ownership_transferred',
    projectName: string,
    projectId: string,
    actorName: string,
    targetUserName?: string
  ): Promise<Notification | null> {
    let title = '';
    let message = '';
    const actionUrl = `/app/collaboration/projects/${projectId}`;
    let actionText = 'View Project';

    switch (type) {
      case 'project_member_added':
        title = 'Added to Project';
        message = `${actorName} added you to the project "${projectName}"`;
        break;
      case 'project_member_removed':
        title = 'Removed from Project';
        message = `${actorName} removed you from the project "${projectName}"`;
        break;
      case 'project_ownership_transferred':
        title = 'Project Ownership Transferred';
        message = `${actorName} transferred ownership of project "${projectName}" to you`;
        actionText = 'Manage Project';
        break;
    }

    return this.createNotification({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl,
      action_text: actionText,
      metadata: { 
        project_id: projectId, 
        project_name: projectName,
        actor_name: actorName,
        target_user_name: targetUserName
      }
    });
  }

  // Helper method to create chat notifications
  async createChatNotification(
    userId: string,
    type: 'message_received' | 'chat_mention',
    senderName: string,
    chatName: string,
    chatId: string,
    messagePreview: string,
    chatType: 'team' | 'project' | 'direct' = 'direct'
  ): Promise<Notification | null> {
    let title = '';
    let message = '';
    let actionUrl = '';
    
    switch (chatType) {
      case 'team':
        actionUrl = `/app/collaboration/teams/${chatId}/chat`;
        break;
      case 'project':
        actionUrl = `/app/collaboration/projects/${chatId}/chat`;
        break;
      case 'direct':
        actionUrl = `/app/chat/${chatId}`;
        break;
    }

    switch (type) {
      case 'message_received':
        title = `New message from ${senderName}`;
        message = chatType === 'direct' ? messagePreview : `In ${chatName}: ${messagePreview}`;
        break;
      case 'chat_mention':
        title = `You were mentioned by ${senderName}`;
        message = chatType === 'direct' ? messagePreview : `In ${chatName}: ${messagePreview}`;
        break;
    }

    return this.createNotification({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl,
      action_text: 'View Message',
      metadata: { 
        chat_id: chatId, 
        chat_name: chatName,
        chat_type: chatType,
        sender_name: senderName,
        message_preview: messagePreview
      }
    });
  }

  // Enhanced task notification method with deadline reminders
  async createEnhancedTaskNotification(
    userId: string,
    type: 'task_assigned' | 'task_completed' | 'task_due_soon' | 'task_deadline_reminder',
    taskTitle: string,
    taskId: string,
    assignerName?: string,
    dueDate?: string
  ): Promise<Notification | null> {
    let title = '';
    let message = '';
    const actionUrl = `/app/tasks`;

    switch (type) {
      case 'task_assigned':
        title = 'New Task Assigned';
        message = `${assignerName || 'Someone'} assigned you the task "${taskTitle}"`;
        if (dueDate) {
          message += ` - Due: ${new Date(dueDate).toLocaleDateString()}`;
        }
        break;
      case 'task_completed':
        title = 'Task Completed';
        message = `Task "${taskTitle}" has been marked as completed`;
        break;
      case 'task_due_soon':
        title = 'Task Due Soon';
        message = `Task "${taskTitle}" is due soon`;
        if (dueDate) {
          const daysUntilDue = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          message += ` (${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} remaining)`;
        }
        break;
      case 'task_deadline_reminder':
        title = 'Task Deadline Reminder';
        message = `Reminder: Task "${taskTitle}" is approaching its deadline`;
        if (dueDate) {
          const hoursUntilDue = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60));
          message += ` (${hoursUntilDue} hour${hoursUntilDue !== 1 ? 's' : ''} remaining)`;
        }
        break;
    }

    return this.createNotification({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl,
      action_text: 'View Task',
      metadata: { 
        task_id: taskId, 
        task_title: taskTitle, 
        assigner_name: assignerName,
        due_date: dueDate
      }
    });
  }

  // Helper method to create welcome notifications for new users
  async createWelcomeNotification(userId: string): Promise<Notification | null> {
    return this.createNotification({
      user_id: userId,
      type: 'welcome_notification',
      title: 'Welcome to the Platform!',
      message: 'Get started by exploring your dashboard and connecting with your team',
      action_url: '/app/dashboard',
      action_text: 'Explore Dashboard',
      metadata: { welcome_type: 'new_user' }
    });
  }

  // Bulk notification creation for multiple users
  async createBulkNotifications(notifications: CreateNotificationData[]): Promise<Notification[]> {
    if (notifications.length === 0) return [];
    
    try {
      const notificationsWithDefaults = notifications.map(notification => ({
        ...notification,
        is_read: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notificationsWithDefaults)
        .select();

      if (error) throw error;
      
      // Show browser notifications for each if permission granted
      if (data && 'Notification' in window && Notification.permission === 'granted') {
        data.forEach(notification => {
          this.showBrowserNotification(notification as Notification);
        });
      }
      
      // Send push notifications
      if (data && data.length > 0) {
        try {
          // Group notifications by user for efficient push delivery
          const notificationsByUser = new Map<string, CreateNotificationData[]>();
          
          notifications.forEach(notification => {
            if (!notificationsByUser.has(notification.user_id)) {
              notificationsByUser.set(notification.user_id, []);
            }
            notificationsByUser.get(notification.user_id)!.push(notification);
          });

          // Send push notifications for each user
          for (const [userId, userNotifications] of notificationsByUser) {
            for (const notificationData of userNotifications) {
              pushNotificationService.sendPushNotification(
                userId,
                pushNotificationService.createNotificationPayload(
                  notificationData.type,
                  notificationData.title,
                  notificationData.message,
                  notificationData.action_url,
                  notificationData.action_text,
                  notificationData.metadata
                )
              ).catch(error => {
                console.error(`Failed to send push notification to user ${userId}:`, error);
              });
            }
          }
        } catch (error) {
          console.error('Error sending bulk push notifications:', error);
        }
      }
      
      return data || [];
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      return [];
    }
  }

  // Browser notification methods
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  showBrowserNotification(notification: Notification): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const browserNotification = new window.Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: notification.id,
      requireInteraction: notification.type === 'call_incoming',
      actions: notification.action_text && notification.action_url ? [
        {
          action: 'view',
          title: notification.action_text
        }
      ] : undefined
    });

    browserNotification.onclick = () => {
      window.focus();
      if (notification.action_url) {
        window.location.hash = notification.action_url;
      }
      browserNotification.close();
    };

    // Auto-close after 10 seconds for non-call notifications
    if (notification.type !== 'call_incoming') {
      setTimeout(() => {
        browserNotification.close();
      }, 10000);
    }
  }

  // Enhanced notification creation with browser and push notifications
  async createAndShowNotification(data: CreateNotificationData): Promise<Notification | null> {
    const notification = await this.createNotification(data);
    
    if (notification) {
      // Show browser notification if permission is granted
      this.showBrowserNotification(notification);
      
      // Send push notification
      try {
        await pushNotificationService.sendPushNotification(
          data.user_id,
          pushNotificationService.createNotificationPayload(
            data.type,
            data.title,
            data.message,
            data.action_url,
            data.action_text,
            data.metadata
          )
        );
      } catch (error) {
        console.error('Failed to send push notification:', error);
      }
    }
    
    return notification;
  }
}

export const notificationService = new NotificationService();